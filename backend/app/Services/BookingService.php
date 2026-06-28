<?php

namespace App\Services;

use App\Models\AvailabilitySlot;
use App\Models\Booking;
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
        array $bookingDates = []
    ): array
    {
        if ((int) $centre->capacity > 0 && $guestCount > (int) $centre->capacity) {
            throw ValidationException::withMessages([
                'guest_count' => "This venue can host up to {$centre->capacity} guests.",
            ]);
        }

        $schedule = count($bookingDates) ? $bookingDates : [['session_type' => $sessionType]];
        $dateCount = count($schedule);
        $venue = collect($schedule)->sum(fn ($row) => ($row['session_type'] ?? $sessionType) === 'full_day'
            ? (float) $centre->full_day_price
            : (float) $centre->half_day_price);

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

    public function create(CommunityCentre $centre, array $data): Booking
    {
        $schedule = $this->normalizeSchedule($data);
        $quote = $this->quote(
            $centre,
            $schedule[0]['session_type'],
            (int) $data['guest_count'],
            $data['food_selections'] ?? [],
            (float) ($data['adjustment_amount'] ?? 0),
            $schedule
        );

        if (abs((float) ($data['adjustment_amount'] ?? 0)) > 0 && blank($data['adjustment_reason'] ?? null)) {
            throw ValidationException::withMessages([
                'adjustment_reason' => 'Explain why a discount or extra charge was added.',
            ]);
        }

        return DB::transaction(function () use ($centre, $data, $quote, $schedule) {
            foreach ($schedule as $slot) {
                $this->assertAvailable($centre->id, $slot['date'], $slot['session_type'], lock: true);
            }

            $booking = Booking::create([
                'booking_no' => 'DSCC-'.strtoupper(Str::random(8)),
                'user_id' => $data['user_id'] ?? null,
                'centre_id' => $centre->id,
                'customer_name' => $data['customer_name'],
                'customer_phone' => $data['customer_phone'],
                'customer_email' => $data['customer_email'] ?? null,
                'event_date' => $schedule[0]['date'],
                'session_type' => $schedule[0]['session_type'],
                'guest_count' => $data['guest_count'],
                'event_type' => $data['event_type'] ?? null,
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
                $this->blockAvailability($centre->id, $slot['date'], $slot['session_type']);
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

            return $booking->load('foodItems', 'bookingDates', 'centre');
        });
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
    public function isAvailable(int $centreId, string $date, string $sessionType, bool $lock = false): bool
    {
        $query = AvailabilitySlot::where('centre_id', $centreId)->whereDate('date', $date);
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

    protected function assertAvailable(int $centreId, string $date, string $sessionType, bool $lock = false): void
    {
        if (! $this->isAvailable($centreId, $date, $sessionType, $lock)) {
            throw ValidationException::withMessages([
                'event_date' => 'This date and session is no longer available. Please choose another slot.',
            ]);
        }
    }

    /**
     * Record a payment (advance or full) against a booking and confirm it.
     */
    public function applyPayment(Booking $booking, string $method, string $type, ?float $customAmount = null): Payment
    {
        $booking->refresh();
        $due = (float) $booking->due_amount;
        $amount = $customAmount !== null
            ? round($customAmount, 2)
            : ($type === 'advance' ? min((float) $booking->advance_amount, $due) : $due);

        if ($amount <= 0 || $amount > $due) {
            throw ValidationException::withMessages([
                'custom_payment_amount' => 'Payment must be greater than zero and cannot exceed the amount due.',
            ]);
        }

        return DB::transaction(function () use ($booking, $method, $type, $amount, $customAmount) {
            $paid = round((float) $booking->paid_amount + $amount, 2);
            $payment = $booking->payment()->updateOrCreate(
                ['booking_id' => $booking->id],
                [
                    'payment_method' => $method,
                    'transaction_id' => 'TXN-'.strtoupper(Str::random(10)),
                    'amount' => $paid,
                    'status' => 'paid',
                    'gateway_response' => ['simulated' => true, 'method' => $method, 'type' => $customAmount !== null ? 'custom' : $type, 'last_amount' => $amount],
                    'paid_at' => now(),
                ]
            );

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
            $paid = (float) $booking->paid_amount;

            if ($customAmount !== null) {
                $refund = min(round($customAmount, 2), $paid);
            } else {
                $percent = $this->refundPercentForDate($booking->event_date->format('Y-m-d'));
                $refund = round($paid * $percent / 100, 2);
            }

            if ($booking->payment) {
                $booking->payment->update([
                    'status' => 'refunded',
                    'refunded_amount' => $refund,
                    'refunded_at' => now(),
                    'gateway_response' => array_merge((array) $booking->payment->gateway_response, [
                        'refund' => ['amount' => $refund, 'reason' => $reason],
                    ]),
                ]);
            }

            $booking->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason' => $reason,
                'refunded_amount' => $refund,
                'due_amount' => 0,
            ]);

            $schedule = $booking->bookingDates()->get();
            if ($schedule->isEmpty()) {
                $this->releaseAvailability($booking->centre_id, $booking->event_date->format('Y-m-d'), $booking->session_type);
            } else {
                foreach ($schedule as $slot) {
                    $this->releaseAvailability($booking->centre_id, $slot->date->format('Y-m-d'), $slot->session_type);
                }
            }

            return $booking->fresh(['payment', 'centre', 'foodItems', 'bookingDates']);
        });
    }

    /** Free the slots a booking was holding (used on cancellation). */
    public function releaseAvailability(int $centreId, string $date, string $sessionType): void
    {
        $sessions = $sessionType === 'full_day'
            ? ['full_day', 'half_day_morning', 'half_day_evening']
            : [$sessionType];

        AvailabilitySlot::where('centre_id', $centreId)
            ->whereDate('date', $date)
            ->whereIn('session_type', $sessions)
            ->where('status', 'booked')
            ->update(['status' => 'available']);
    }

    protected function blockAvailability(int $centreId, string $date, string $sessionType): void
    {
        $sessions = $sessionType === 'full_day'
            ? ['full_day', 'half_day_morning', 'half_day_evening']
            : [$sessionType];

        foreach ($sessions as $session) {
            \App\Models\AvailabilitySlot::updateOrCreate(
                ['centre_id' => $centreId, 'date' => $date, 'session_type' => $session],
                ['status' => 'booked']
            );
        }
    }
}
