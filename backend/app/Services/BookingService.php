<?php

namespace App\Services;

use App\Models\AvailabilitySlot;
use App\Models\Booking;
use App\Models\CentreFloor;
use App\Models\CommunityCentre;
use App\Models\CrmContact;
use App\Models\FoodMenu;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BookingService
{
    // Marketplace-wide settings (would live in DB commission_rules in full build)
    const SERVICE_CHARGE_RATE = 0.05; // 5%
    const VAT_RATE = 0.075;           // 7.5%
    const ADVANCE_RATE = 0.30;        // 30% advance to confirm a booking

    /**
     * Refund policy by days remaining before the event (% of amount paid).
     * Owners/admin may still override with a custom partial amount.
     */
    public function refundPercentForDate(string $eventDate): int
    {
        $days = now()->startOfDay()->diffInDays(\Carbon\Carbon::parse($eventDate)->startOfDay(), false);
        return match (true) {
            $days >= 7 => 100,
            $days >= 3 => 50,
            default => 0,
        };
    }

    /**
     * Compute a price breakdown without persisting.
     *
     * @param  array  $foodSelections  [['food_menu_id' => int, 'quantity' => int], ...]
     */
    public function quote(
        CommunityCentre $centre,
        string $sessionType,
        int $guestCount,
        array $foodSelections,
        float $adjustmentAmount = 0,
        array $bookingDates = [],
        ?CentreFloor $floor = null
    ): array
    {
        // A floor overrides the venue's capacity and pricing; falling back to the
        // centre's values when the floor leaves them unset.
        $this->assertGuestCapacity($centre, $guestCount, $floor);
        $fullDayPrice = (float) ($floor && $floor->full_day_price > 0 ? $floor->full_day_price : $centre->full_day_price);
        $halfDayPrice = (float) ($floor && $floor->half_day_price > 0 ? $floor->half_day_price : $centre->half_day_price);

        $schedule = count($bookingDates) ? $bookingDates : [['session_type' => $sessionType]];
        $dateCount = count($schedule);
        $venue = collect($schedule)->sum(fn ($row) => ($row['session_type'] ?? $sessionType) === 'full_day'
            ? $fullDayPrice
            : $halfDayPrice);

        $foodLines = [];
        $foodAmount = 0.0;

        foreach ($foodSelections as $sel) {
            $menu = FoodMenu::where('centre_id', $centre->id)
                ->where('id', $sel['food_menu_id'] ?? null)
                ->first();
            if (! $menu) {
                continue;
            }
            $qty = max((int) ($sel['quantity'] ?? $guestCount), $menu->min_guest_count, 0);
            $totalQty = $qty * $dateCount;
            $lineTotal = round($totalQty * (float) $menu->price_per_person, 2);
            $foodAmount += $lineTotal;
            $foodLines[] = [
                'food_menu_id' => $menu->id,
                'menu_name' => $menu->name,
                'quantity' => $totalQty,
                'unit_price' => (float) $menu->price_per_person,
                'total_price' => $lineTotal,
            ];
        }

        $subtotal = $venue + $foodAmount;
        $commissionRate = (float) ($centre->commission_rate ?? (self::SERVICE_CHARGE_RATE * 100));
        $serviceCharge = round($subtotal * $commissionRate / 100, 2);
        $vat = round(($subtotal + $serviceCharge) * self::VAT_RATE, 2);
        $beforeAdjustment = round($subtotal + $serviceCharge + $vat, 2);
        $adjustmentAmount = round($adjustmentAmount, 2);
        $total = round($beforeAdjustment + $adjustmentAmount, 2);
        if ($total < 0) {
            throw ValidationException::withMessages([
                'adjustment_amount' => 'The discount cannot be greater than the booking total.',
            ]);
        }

        return [
            'venue_amount' => round($venue, 2),
            'food_amount' => round($foodAmount, 2),
            'service_charge' => $serviceCharge,
            'vat_amount' => $vat,
            'adjustment_amount' => $adjustmentAmount,
            'total_amount' => $total,
            'advance_amount' => round($total * self::ADVANCE_RATE, 2),
            'advance_rate' => (int) (self::ADVANCE_RATE * 100),
            'commission_rate' => $commissionRate,
            'date_count' => $dateCount,
            'food_lines' => $foodLines,
        ];
    }

    public function assertGuestCapacity(CommunityCentre $centre, int $guestCount, ?CentreFloor $floor = null): void
    {
        $capacity = (int) ($floor && $floor->capacity > 0 ? $floor->capacity : $centre->capacity);
        if ($capacity > 0 && $guestCount > $capacity) {
            $where = $floor ? $floor->name : 'This venue';
            throw ValidationException::withMessages([
                'guest_count' => "{$where} can host up to {$capacity} guests.",
            ]);
        }
    }

    public function create(CommunityCentre $centre, array $data): Booking
    {
        $decorator = null;
        if (isset($data['decorator_id'])) {
            $decorator = (int) $data['decorator_id'] === 0
                ? ($centre->decorator_name && $centre->decorator_phone
                    ? ['id' => null, 'name' => $centre->decorator_name, 'phone' => $centre->decorator_phone]
                    : null)
                : $centre->decorators()->whereKey($data['decorator_id'])->where('status', 'active')
                    ->first()?->only(['id', 'name', 'phone']);
            if (! $decorator) {
                throw ValidationException::withMessages(['decorator_id' => 'Choose an active decorator for this centre.']);
            }
        }
        $schedule = $this->normalizeSchedule($data);
        $floor = $this->resolveFloor($centre, $data['centre_floor_id'] ?? null);
        $quote = $this->quote(
            $centre,
            $schedule[0]['session_type'],
            (int) $data['guest_count'],
            $data['food_selections'] ?? [],
            (float) ($data['adjustment_amount'] ?? 0),
            $schedule,
            $floor
        );

        if (isset($data['expected_total_amount'])
            && (int) round((float) $data['expected_total_amount'] * 100) !== (int) round($quote['total_amount'] * 100)) {
            throw ValidationException::withMessages([
                'expected_total_amount' => 'The booking price has changed. Please edit your booking and review the updated price before paying.',
            ]);
        }

        if (abs((float) ($data['adjustment_amount'] ?? 0)) > 0 && blank($data['adjustment_reason'] ?? null)) {
            throw ValidationException::withMessages([
                'adjustment_reason' => 'Explain why a discount or extra charge was added.',
            ]);
        }

        return DB::transaction(function () use ($centre, $data, $quote, $schedule, $floor, $decorator) {
            // Serialize requests for this centre even when no slot row exists yet.
            CommunityCentre::whereKey($centre->id)->lockForUpdate()->firstOrFail();
            foreach ($schedule as $slot) {
                $this->assertAvailable($centre->id, $slot['date'], $slot['session_type'], lock: true, floorId: $floor?->id);
            }

            $booking = Booking::create([
                'booking_no' => (strtoupper($centre->booking_prefix ?: 'ICCMS')).'-'.strtoupper(Str::random(8)),
                'user_id' => $data['user_id'] ?? null,
                'centre_id' => $centre->id,
                'centre_floor_id' => $floor?->id,
                'customer_name' => $data['customer_name'],
                'customer_phone' => $data['customer_phone'],
                'customer_email' => $data['customer_email'] ?? null,
                'event_date' => $schedule[0]['date'],
                'session_type' => $schedule[0]['session_type'],
                'guest_count' => $data['guest_count'],
                'event_type' => $data['event_type'] ?? null,
                'event_manager_name' => $data['event_manager_name'] ?? null,
                'event_manager_phone' => $data['event_manager_phone'] ?? null,
                'centre_decorator_id' => $decorator['id'] ?? null,
                'decorator_name' => $decorator['name'] ?? null,
                'decorator_phone' => $decorator['phone'] ?? null,
                'venue_amount' => $quote['venue_amount'],
                'food_amount' => $quote['food_amount'],
                'service_charge' => $quote['service_charge'],
                'vat_amount' => $quote['vat_amount'],
                'adjustment_amount' => $quote['adjustment_amount'],
                'adjustment_reason' => $data['adjustment_reason'] ?? null,
                'total_amount' => $quote['total_amount'],
                'payment_option' => $data['payment_option'] ?? 'full',
                'advance_amount' => $quote['advance_amount'],
                'paid_amount' => 0,
                'due_amount' => $quote['total_amount'],
                'refunded_amount' => 0,
                'status' => 'pending_review',
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($quote['food_lines'] as $line) {
                $booking->foodItems()->create($line);
            }

            $booking->bookingDates()->createMany($schedule);

            foreach ($schedule as $slot) {
                $this->blockAvailability($centre->id, $slot['date'], $slot['session_type'], $floor?->id);
            }

            $contact = CrmContact::firstOrNew([
                'centre_id' => $centre->id,
                'phone' => $booking->customer_phone,
            ]);
            $contact->name = $booking->customer_name;
            $contact->email = $booking->customer_email ?: $contact->email;
            $contact->source = $contact->exists ? $contact->source : 'booking';
            $contact->stage = $contact->exists ? $contact->stage : 'customer';
            $contact->save();

            return $booking->load('foodItems', 'bookingDates', 'centre', 'floor');
        });
    }

    /**
     * Resolve the requested floor, enforcing that it belongs to this centre and
     * that a floor is chosen whenever the centre has bookable floors.
     */
    public function resolveFloor(CommunityCentre $centre, $floorId): ?CentreFloor
    {
        $hasFloors = $centre->activeFloors()->exists();

        if (! $floorId) {
            if ($hasFloors) {
                throw ValidationException::withMessages([
                    'centre_floor_id' => 'This venue is booked by floor — please choose one.',
                ]);
            }
            return null;
        }

        $floor = $centre->activeFloors()->whereKey($floorId)->first();
        if (! $floor) {
            throw ValidationException::withMessages([
                'centre_floor_id' => 'That floor is not available at this venue.',
            ]);
        }
        return $floor;
    }

    protected function normalizeSchedule(array $data): array
    {
        $rows = $data['booking_dates'] ?? [[
            'date' => $data['event_date'],
            'session_type' => $data['session_type'],
        ]];

        return collect($rows)
            ->map(fn ($row) => [
                'date' => $row['date'],
                'session_type' => $row['session_type'],
            ])
            ->unique(fn ($row) => $row['date'].'|'.$row['session_type'])
            ->sortBy('date')
            ->values()
            ->all();
    }

    /**
     * Is the given date+session bookable?
     * Full-day needs every session free; half-day needs its own session and full-day free.
     */
    public function isAvailable(int $centreId, string $date, string $sessionType, bool $lock = false, ?int $floorId = null): bool
    {
        $conflictingSessions = $sessionType === 'full_day'
            ? ['full_day', 'half_day_morning', 'half_day_evening']
            : [$sessionType, 'full_day'];

        // Booking dates are authoritative; availability rows can be missing in older data.
        $alreadyBooked = Booking::where('centre_id', $centreId)
            ->where('centre_floor_id', $floorId)
            ->whereNotIn('status', ['cancelled', 'refunded'])
            ->whereHas('bookingDates', fn ($query) => $query
                ->whereDate('date', $date)
                ->whereIn('session_type', $conflictingSessions))
            ->exists();
        if ($alreadyBooked) {
            return false;
        }

        $query = AvailabilitySlot::where('centre_id', $centreId)
            ->where('centre_floor_id', $floorId)   // null = whole-venue booking
            ->whereDate('date', $date);
        if ($lock) {
            $query->lockForUpdate();
        }
        $slots = $query->get()->keyBy('session_type');

        $taken = fn (string $s) => isset($slots[$s])
            && in_array($slots[$s]->status, ['booked', 'blocked'], true);

        if ($sessionType === 'full_day') {
            return ! $taken('full_day')
                && ! $taken('half_day_morning')
                && ! $taken('half_day_evening');
        }

        return ! $taken($sessionType) && ! $taken('full_day');
    }

    protected function assertAvailable(int $centreId, string $date, string $sessionType, bool $lock = false, ?int $floorId = null): void
    {
        if (! $this->isAvailable($centreId, $date, $sessionType, $lock, $floorId)) {
            throw ValidationException::withMessages([
                'event_date' => 'This date and session is no longer available. Please choose another slot.',
            ]);
        }
    }

    /**
     * Record a payment (advance or full) against a booking and confirm it.
     */
    public function applyPayment(Booking $booking, string $method, string $type, ?float $customAmount = null, ?string $requestKey = null): Payment
    {
        return DB::transaction(function () use ($booking, $method, $type, $customAmount, $requestKey) {
            $booking = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            $key = $requestKey ? 'offline-request:'.$booking->id.':'.$requestKey : null;
            if ($key && ($receipt = \App\Models\PaymentReceipt::where('source_key', $key)->first())) {
                if ($receipt->payment_method !== $method || ($customAmount !== null && round((float) $receipt->amount, 2) !== round($customAmount, 2))) {
                    throw ValidationException::withMessages(['request_key' => 'This payment reference was already used for another payment.']);
                }
                return Payment::findOrFail($receipt->payment_id);
            }
            if (in_array($booking->status, ['cancelled', 'completed', 'refunded'], true)
                || $booking->payment?->payment_method === 'ekPay') {
                throw ValidationException::withMessages(['booking_no' => 'This booking cannot accept an offline payment.']);
            }
            if ($booking->paymentAttempts()->whereIn('status', ['initiating', 'pending'])->exists()) {
                throw ValidationException::withMessages(['booking_no' => 'An online payment is in progress.']);
            }
            $due = (float) $booking->due_amount;
            $amount = $customAmount !== null
                ? round($customAmount, 2)
                : ($type === 'advance' ? min((float) $booking->advance_amount, $due) : $due);
            if ($amount <= 0 || $amount > $due) {
                throw ValidationException::withMessages([
                    'custom_payment_amount' => 'Payment must be greater than zero and cannot exceed the amount due.',
                ]);
            }
            $paid = round((float) $booking->paid_amount + $amount, 2);
            PaymentReceipts::preserveLegacy($booking);
            $previousGross = in_array($booking->payment?->status, ['paid', 'refunded'], true) ? (float) $booking->payment->amount : 0;
            $gross = round($previousGross + $amount, 2);
            $payment = $booking->payment()->updateOrCreate(
                ['booking_id' => $booking->id],
                [
                    'payment_method' => $method,
                    'transaction_id' => 'TXN-'.strtoupper(Str::random(10)),
                    'amount' => $gross,
                    'status' => 'paid',
                    'gateway_response' => ['offline' => true, 'method' => $method, 'type' => $customAmount !== null ? 'custom' : $type, 'last_amount' => $amount],
                    'paid_at' => now(),
                ]
            );
            PaymentReceipts::record($booking, $payment, $amount, $key ?? 'offline:'.$payment->transaction_id, 'offline');

            $dueAfter = max(round((float) $booking->total_amount - $paid, 2), 0);
            $booking->update([
                'paid_amount' => $paid,
                'due_amount' => $dueAfter,
                'payment_option' => $dueAfter > 0 ? 'advance' : 'full',
                'status' => 'confirmed',
            ]);

            return $payment;
        });
    }

    /**
     * Cancel a booking and compute the refund.
     * Pass $customAmount for a manual partial refund, otherwise the date-based policy applies.
     */
    public function cancelAndRefund(Booking $booking, ?string $reason = null, ?float $customAmount = null): Booking
    {
        return DB::transaction(function () use ($booking, $reason, $customAmount) {
            $booking = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if (in_array($booking->status, ['cancelled', 'refunded'], true)) {
                return $booking->load(['payment', 'centre', 'foodItems', 'bookingDates']);
            }
            if ($booking->payment?->payment_method === 'ekPay' && (float) $booking->paid_amount > 0) {
                throw ValidationException::withMessages(['booking_no' => 'Contact support for an ekPay cancellation and refund.']);
            }
            $paid = (float) $booking->paid_amount;

            if ($customAmount !== null) {
                if ($customAmount < 0 || round($customAmount, 2) > $paid) {
                    throw ValidationException::withMessages(['amount' => 'Refund cannot exceed the remaining paid balance.']);
                }
                $refund = round($customAmount, 2);
            } else {
                $percent = $this->refundPercentForDate($booking->event_date->format('Y-m-d'));
                $refund = round($paid * $percent / 100, 2);
            }

            if ($refund > 0) {
                $booking = $this->refund($booking, $refund, $reason, 'cancel:'.$booking->id);
            }

            $booking->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason' => $reason,
                'due_amount' => 0,
            ]);

            $schedule = $booking->bookingDates()->get();
            if ($schedule->isEmpty()) {
                $this->releaseAvailability($booking->centre_id, $booking->event_date->format('Y-m-d'), $booking->session_type, $booking->centre_floor_id);
            } else {
                foreach ($schedule as $slot) {
                    $this->releaseAvailability($booking->centre_id, $slot->date->format('Y-m-d'), $slot->session_type, $booking->centre_floor_id);
                }
            }

            return $booking->fresh(['payment', 'centre', 'foodItems', 'bookingDates']);
        });
    }

    /**
     * Issue a standalone refund (full or partial) against a booking's paid amount
     * without cancelling it. Adds to refunded_amount and reduces paid/due.
     */
    public function refund(Booking $booking, float $amount, ?string $reason = null, ?string $requestKey = null): Booking
    {
        return DB::transaction(function () use ($booking, $amount, $reason, $requestKey) {
            $booking = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if ($requestKey && ($previous = DB::table('payment_refunds')->where('booking_id', $booking->id)->where('request_key', $requestKey)->first())) {
                if (round((float) $previous->amount, 2) !== round($amount, 2)) {
                    throw ValidationException::withMessages(['request_key' => 'This refund reference was already used for another amount.']);
                }
                return $booking->load(['payment', 'centre', 'foodItems', 'bookingDates']);
            }
            if ($booking->payment?->payment_method === 'ekPay') {
                throw ValidationException::withMessages(['booking_no' => 'ekPay refunds require manual gateway reconciliation.']);
            }
            // Existing settlements are immutable obligations: do not silently reduce their backing.
            if (DB::table('settlement_items')->where('booking_id', $booking->id)->exists()) {
                throw ValidationException::withMessages(['amount' => 'This booking has a settlement. Reconcile the settlement before issuing a refund.']);
            }
            // Older cancelled bookings retained their gross paid balance; cap by payment history too.
            $refundable = min(round((float) $booking->paid_amount, 2),
                round((float) ($booking->payment?->amount ?? 0) - (float) ($booking->payment?->refunded_amount ?? 0), 2));
            $refund = round($amount, 2);
            if ($refund <= 0 || $refund > $refundable || ! $booking->payment) {
                throw ValidationException::withMessages(['amount' => 'Refund must be positive and cannot exceed the remaining paid balance.']);
            }
            PaymentReceipts::preserveLegacy($booking);
            $remaining = $refund;
            foreach (\App\Models\PaymentReceipt::where('booking_id', $booking->id)->orderByDesc('id')->lockForUpdate()->get() as $receipt) {
                $part = min($remaining, max(round((float) $receipt->amount - (float) $receipt->refunded_amount, 2), 0));
                if ($part > 0) {
                    $receipt->update(['refunded_amount' => round((float) $receipt->refunded_amount + $part, 2), 'status' => 'refunded']);
                    $remaining = round($remaining - $part, 2);
                }
            }
            if ($remaining > 0) {
                throw ValidationException::withMessages(['amount' => 'Payment history needs reconciliation before this refund.']);
            }
            DB::table('payment_refunds')->insert(['booking_id' => $booking->id, 'request_key' => $requestKey,
                'amount' => $refund, 'reason' => $reason, 'created_at' => now(), 'updated_at' => now()]);

            $newPaid = round($refundable - $refund, 2);
            $newRefunded = round((float) $booking->refunded_amount + $refund, 2);

            if ($booking->payment) {
                $booking->payment->update([
                    'status' => 'refunded',
                    'refunded_amount' => $newRefunded,
                    'refunded_at' => now(),
                    'gateway_response' => array_merge((array) $booking->payment->gateway_response, [
                        'refund' => ['amount' => $refund, 'reason' => $reason, 'at' => now()->toDateTimeString()],
                    ]),
                ]);
            }

            $booking->update([
                'paid_amount' => $newPaid,
                'refunded_amount' => $newRefunded,
                'due_amount' => in_array($booking->status, ['cancelled', 'refunded'], true) ? 0 : max(round((float) $booking->total_amount - $newPaid, 2), 0),
            ]);

            return $booking->fresh(['payment', 'centre', 'foodItems', 'bookingDates']);
        });
    }

    /** Free the slots a booking was holding (used on cancellation). */
    public function releaseAvailability(int $centreId, string $date, string $sessionType, ?int $floorId = null): void
    {
        $sessions = $sessionType === 'full_day'
            ? ['full_day', 'half_day_morning', 'half_day_evening']
            : [$sessionType];

        AvailabilitySlot::where('centre_id', $centreId)
            ->where('centre_floor_id', $floorId)
            ->whereDate('date', $date)
            ->whereIn('session_type', $sessions)
            ->where('status', 'booked')
            ->update(['status' => 'available']);
    }

    protected function blockAvailability(int $centreId, string $date, string $sessionType, ?int $floorId = null): void
    {
        $sessions = $sessionType === 'full_day'
            ? ['full_day', 'half_day_morning', 'half_day_evening']
            : [$sessionType];

        foreach ($sessions as $session) {
            AvailabilitySlot::updateOrCreate(
                ['centre_id' => $centreId, 'centre_floor_id' => $floorId, 'date' => $date, 'session_type' => $session],
                ['status' => 'booked']
            );
        }
    }
}
