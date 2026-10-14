<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\PaymentReceipt;
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
            CommunityCentre::whereKey($centre->id)->lockForUpdate()->firstOrFail();
            $bookings = Booking::query()
                ->where('centre_id', $centre->id)
                ->where('paid_amount', '>', 0)
                ->whereIn('status', ['paid', 'confirmed', 'completed'])
                ->whereHas('payment')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $lines = collect();
            foreach ($bookings as $booking) {
                PaymentReceipts::preserveLegacy($booking);
                $prior = DB::table('settlement_items')->where('booking_id', $booking->id);
                $settledGross = (float) (clone $prior)->sum('gross_amount');
                $settledTax = (float) (clone $prior)->sum('tax_amount');
                $settledCommission = (float) (clone $prior)->sum('commission_amount');
                $legacyCredit = (float) (clone $prior)->whereNull('payment_receipt_id')->sum('gross_amount');
                $receipts = PaymentReceipt::where('booking_id', $booking->id)
                    ->whereRaw("LOWER(TRIM(payment_method)) <> 'cash'")
                    ->whereIn('status', ['paid', 'refunded'])
                    ->whereDate('paid_at', '>=', $data['period_start'])
                    ->whereDate('paid_at', '<=', $data['period_end'])
                    ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('settlement_items')->whereColumn('payment_receipt_id', 'payment_receipts.id'))
                    ->orderBy('paid_at')->orderBy('id')->lockForUpdate()->get();
                foreach ($receipts as $receipt) {
                    $gross = round((float) $receipt->amount - (float) $receipt->refunded_amount, 2);
                    if ($receipt->source === 'legacy_aggregate') {
                        $gross = max(round($gross - $legacyCredit, 2), 0);
                    }
                    // Never reserve more than the booking's current net paid balance.
                    $gross = min($gross, max(round((float) $booking->paid_amount - $settledGross, 2), 0));
                    if ($gross <= 0) {
                        continue;
                    }
                    $ratio = (float) $booking->total_amount > 0 ? min(($settledGross + $gross) / (float) $booking->total_amount, 1) : 0;
                    $commission = max(round((float) $booking->service_charge * $ratio - $settledCommission, 2), 0);
                    $tax = max(round((float) $booking->vat_amount * $ratio - $settledTax, 2), 0);
                    $lines->push(['booking_id' => $booking->id, 'payment_receipt_id' => $receipt->id,
                        'gross_amount' => $gross, 'commission_amount' => $commission, 'tax_amount' => $tax,
                        'net_amount' => round($gross - $commission - $tax, 2)]);
                    $settledGross += $gross;
                    $settledTax += $tax;
                    $settledCommission += $commission;
                }
            }
            if ($lines->isEmpty()) {
                throw ValidationException::withMessages(['period_start' => 'No eligible payout receipts were found. Cash collected at the centre is excluded from payouts.']);
            }

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
        return DB::transaction(function () use ($settlement, $data) {
            $settlement = Settlement::whereKey($settlement->id)->lockForUpdate()->firstOrFail();
            $target = $data['status'];
            if (in_array($target, ['approved', 'paid'], true) && $settlement->items()->centreCash()->exists()) {
                throw ValidationException::withMessages(['status' => 'This settlement includes centre-collected cash. Reconcile it before approval or payout; cash must not be paid twice.']);
            }
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
        });
    }
}
