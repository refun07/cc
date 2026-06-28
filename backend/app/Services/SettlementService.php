<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\Settlement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SettlementService
{
    public function generate(CommunityCentre $centre, array $data, User $admin): Settlement
    {
        return DB::transaction(function () use ($centre, $data, $admin) {
            $bookings = Booking::query()
                ->where('centre_id', $centre->id)
                ->where('paid_amount', '>', 0)
                ->whereIn('status', ['paid', 'confirmed', 'completed'])
                ->whereHas('payment', fn ($q) => $q->where('status', 'paid')
                    ->whereDate('paid_at', '>=', $data['period_start'])
                    ->whereDate('paid_at', '<=', $data['period_end']))
                ->whereDoesntHave('settlementItem')
                ->lockForUpdate()
                ->get();

            if ($bookings->isEmpty()) {
                throw ValidationException::withMessages([
                    'period_start' => 'No unsettled paid bookings were found for this centre and period.',
                ]);
            }

            $lines = $bookings->map(function (Booking $booking) {
                $ratio = (float) $booking->total_amount > 0
                    ? min((float) $booking->paid_amount / (float) $booking->total_amount, 1)
                    : 0;
                $gross = round((float) $booking->paid_amount, 2);
                $commission = round((float) $booking->service_charge * $ratio, 2);
                $tax = round((float) $booking->vat_amount * $ratio, 2);

                return [
                    'booking_id' => $booking->id,
                    'gross_amount' => $gross,
                    'commission_amount' => $commission,
                    'tax_amount' => $tax,
                    'net_amount' => round($gross - $commission - $tax, 2),
                ];
            });

            $gross = round($lines->sum('gross_amount'), 2);
            $commission = round($lines->sum('commission_amount'), 2);
            $tax = round($lines->sum('tax_amount'), 2);
            $adjustment = round((float) ($data['adjustment_amount'] ?? 0), 2);
            $net = round($gross - $commission - $tax + $adjustment, 2);

            if ($net < 0) {
                throw ValidationException::withMessages([
                    'adjustment_amount' => 'The adjustment cannot make the settlement payout negative.',
                ]);
            }

            $settlement = Settlement::create([
                'settlement_no' => 'STL-'.now()->format('ym').'-'.strtoupper(Str::random(6)),
                'centre_id' => $centre->id,
                'period_start' => $data['period_start'],
                'period_end' => $data['period_end'],
                'gross_amount' => $gross,
                'commission_amount' => $commission,
                'tax_amount' => $tax,
                'adjustment_amount' => $adjustment,
                'net_amount' => $net,
                'notes' => $data['notes'] ?? null,
                'created_by' => $admin->id,
            ]);

            $settlement->items()->createMany($lines->all());

            Notify::send(
                $centre->owner_id,
                'New settlement generated',
                "Settlement {$settlement->settlement_no} is ready for review. Net payout: {$settlement->net_amount}.",
                'settlement',
                '/owner/accounting'
            );

            return $settlement->load('centre:id,name,slug,commission_rate', 'items.booking:id,booking_no,customer_name,event_date');
        });
    }

    public function transition(Settlement $settlement, array $data): Settlement
    {
        $target = $data['status'];
        $allowed = [
            'pending' => ['approved', 'held'],
            'held' => ['pending', 'approved'],
            'approved' => ['paid', 'held'],
            'paid' => [],
        ];

        if (! in_array($target, $allowed[$settlement->status] ?? [], true)) {
            throw ValidationException::withMessages([
                'status' => "A {$settlement->status} settlement cannot be changed to {$target}.",
            ]);
        }

        if ($target === 'paid' && empty($data['payment_reference'])) {
            throw ValidationException::withMessages([
                'payment_reference' => 'A payment reference is required before marking a settlement paid.',
            ]);
        }

        $settlement->update([
            'status' => $target,
            'payment_method' => $data['payment_method'] ?? $settlement->payment_method,
            'payment_reference' => $data['payment_reference'] ?? $settlement->payment_reference,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $settlement->notes,
            'approved_at' => $target === 'approved' ? now() : $settlement->approved_at,
            'paid_at' => $target === 'paid' ? now() : $settlement->paid_at,
        ]);

        Notify::send(
            $settlement->centre?->owner_id,
            'Settlement '.$target,
            "Settlement {$settlement->settlement_no} is now {$target}.",
            'settlement',
            '/owner/accounting'
        );

        return $settlement->fresh()->load('centre:id,name,slug,commission_rate', 'items.booking:id,booking_no,customer_name,event_date');
    }
}
