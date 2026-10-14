<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\PaymentReceipt;
use Illuminate\Support\Facades\DB;

class PaymentReceipts
{
    // Call with the booking row locked, before changing its aggregate payment.
    public static function preserveLegacy(Booking $booking): void
    {
        $payment = $booking->payment()->first();
        if (! $payment || PaymentReceipt::where('payment_id', $payment->id)->exists()) {
            return;
        }
        $ratio = (float) $booking->total_amount > 0 ? min((float) $payment->amount / (float) $booking->total_amount, 1) : 1;
        PaymentReceipt::create([
            'payment_id' => $payment->id, 'booking_id' => $booking->id,
            'source_key' => 'legacy:'.$payment->id, 'source' => 'legacy_aggregate',
            'transaction_id' => $payment->transaction_id, 'payment_method' => $payment->payment_method,
            'amount' => $payment->amount, 'refunded_amount' => $payment->refunded_amount,
            'vat_amount' => round((float) $booking->vat_amount * $ratio, 2), 'commission' => round((float) $booking->service_charge * $ratio, 2),
            'status' => $payment->status, 'paid_at' => $payment->paid_at,
        ]);
        if ((float) $payment->refunded_amount > 0) {
            DB::table('payment_refunds')->insertOrIgnore([
                'booking_id' => $booking->id, 'request_key' => 'legacy:'.$payment->id,
                'amount' => $payment->refunded_amount, 'reason' => 'Legacy aggregate refund',
                'created_at' => $payment->refunded_at, 'updated_at' => $payment->refunded_at,
            ]);
        }
    }

    public static function record(Booking $booking, Payment $payment, float $amount, string $key, string $source): void
    {
        $existing = PaymentReceipt::where('booking_id', $booking->id)->whereIn('status', ['paid', 'refunded']);
        $before = (float) (clone $existing)->sum('amount');
        $total = (float) $booking->total_amount;
        // Cumulative rounding assigns the final cent once, even across small installments.
        $allocation = fn ($fee) => $total > 0
            ? round($fee * min(($before + $amount) / $total, 1), 2) - round($fee * min($before / $total, 1), 2)
            : 0;
        PaymentReceipt::create([
            'payment_id' => $payment->id, 'booking_id' => $booking->id,
            'source_key' => $key, 'source' => $source,
            'transaction_id' => $payment->transaction_id, 'payment_method' => $payment->payment_method,
            'amount' => $amount, 'vat_amount' => $allocation((float) $booking->vat_amount),
            'commission' => $allocation((float) $booking->service_charge), 'paid_at' => now(),
        ]);
    }

    public static function reportQuery()
    {
        $columns = 'id, booking_id, transaction_id, payment_method, amount, refunded_amount, status, paid_at, vat_amount, commission, source';
        $receipts = DB::table('payment_receipts')->selectRaw($columns);
        // Read-only fallback also supports imports not yet materialized by the backfill.
        $ratio = 'CASE WHEN b.total_amount > 0 AND p.amount < b.total_amount THEN 1.0 * p.amount / b.total_amount ELSE 1 END';
        $legacy = DB::table('payments as p')->join('bookings as b', 'b.id', '=', 'p.booking_id')
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('payment_receipts as r')->whereColumn('r.payment_id', 'p.id'))
            ->selectRaw("-p.id as id, p.booking_id, p.transaction_id, p.payment_method, p.amount, p.refunded_amount, p.status, p.paid_at, ROUND(b.vat_amount * ($ratio), 2) as vat_amount, ROUND(b.service_charge * ($ratio), 2) as commission, 'legacy_aggregate' as source");

        return (new PaymentReceipt)->setTable('payments')->newQuery()->fromSub($receipts->unionAll($legacy), 'payments');
    }

    public static function centreCashSummary(?array $centreIds = null): array
    {
        $rows = self::reportQuery()->whereRaw("LOWER(TRIM(payment_method)) = 'cash'")
            ->whereIn('status', ['paid', 'refunded'])
            ->when($centreIds !== null, fn ($q) => $q->whereIn('booking_id', Booking::whereIn('centre_id', $centreIds)->select('id')))
            ->get();
        $net = fn ($row) => max((float) $row->amount - (float) $row->refunded_amount, 0);

        return [
            'net_collected' => round($rows->sum($net), 2),
            // This is an allocation for reconciliation, not a record of remitted tax/fees.
            'fees_tax_to_reconcile' => round($rows->sum(fn ($row) => (float) $row->amount > 0
                ? ((float) $row->vat_amount + (float) $row->commission) * $net($row) / (float) $row->amount : 0), 2),
        ];
    }
}
