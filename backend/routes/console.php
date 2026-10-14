<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('payments:reconcile-ekpay', function (\App\Services\EkpayGateway $gateway, \App\Services\EkpayPayments $payments) {
    if (! $gateway->configured()) {
        return;
    }
    \App\Models\PaymentAttempt::query()
        ->where('status', 'pending')
        ->where('initiated_at', '<', now()->subMinutes(2))
        ->chunkById(50, function ($attempts) use ($payments) {
            foreach ($attempts as $attempt) {
                $payments->reconcile($attempt);
            }
        });
})->purpose('Reconcile pending ekPay payments with the gateway');

Schedule::command('payments:reconcile-ekpay')->everyFiveMinutes()->withoutOverlapping();

Artisan::command('waste:alert-delays', function (\App\Services\WasteDelayAlerts $alerts) {
    $this->info($alerts->sendNewAlerts().' overdue pickup alerts created.');
})->purpose('Notify area and city admins when scheduled waste pickups are overdue');

Schedule::command('waste:alert-delays')->everyFifteenMinutes()->withoutOverlapping();
