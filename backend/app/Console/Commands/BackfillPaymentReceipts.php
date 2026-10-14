<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\PaymentReceipt;
use App\Services\PaymentReceipts;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillPaymentReceipts extends Command
{
    protected $signature = 'payments:backfill-receipts {--apply : Materialize legacy snapshots without changing payments or bookings}';

    protected $description = 'Preserve existing aggregate payments as explicitly labelled legacy history';

    public function handle(): int
    {
        $query = Payment::whereNotExists(fn ($q) => $q->selectRaw('1')->from('payment_receipts')->whereColumn('payment_receipts.payment_id', 'payments.id'));
        $this->info('Legacy aggregates without receipts: '.$query->count());
        if (! $this->option('apply')) {
            return self::SUCCESS;
        }
        $query->orderBy('id')->chunkById(100, function ($payments) {
            foreach ($payments as $payment) {
                DB::transaction(function () use ($payment) {
                    $booking = Booking::whereKey($payment->booking_id)->lockForUpdate()->firstOrFail();
                    PaymentReceipts::preserveLegacy($booking);
                });
            }
        });
        $this->info('Legacy receipt count: '.PaymentReceipt::where('source', 'legacy_aggregate')->count());

        return self::SUCCESS;
    }
}
