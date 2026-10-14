<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\PaymentAttempt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class EkpayPayments
{
    public function __construct(private EkpayGateway $gateway) {}

    public function start(Booking $booking, string $option): string
    {
        abort_unless($this->gateway->configured(), 503, 'Online payment is not configured yet.');
        abort_unless($this->gateway->availableTo($booking->user), 403, 'Sandbox payment is restricted to a test account.');

        $attempt = DB::transaction(function () use ($booking, $option) {
            $booking = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if (in_array($booking->status, ['cancelled', 'completed', 'refunded'], true)) {
                throw ValidationException::withMessages(['booking_no' => 'This booking cannot be paid online.']);
            }

            $active = $booking->paymentAttempts()->whereIn('status', ['initiating', 'pending'])->latest()->first();
            if ($active) {
                if ($active->status === 'pending' && $active->secure_token && $active->expires_at?->isFuture()) {
                    return $active;
                }
                throw ValidationException::withMessages(['booking_no' => 'A payment is already in progress. Contact support if it does not finish.']);
            }

            $due = self::cents($booking->due_amount);
            $advance = self::cents($booking->advance_amount);
            $amount = $option === 'advance' ? min($advance, $due) : $due;
            if ($amount <= 0) {
                throw ValidationException::withMessages(['booking_no' => 'This booking has no outstanding balance.']);
            }

            return $booking->paymentAttempts()->create([
                'transaction_id' => 'ICCMS'.strtoupper(Str::random(23)),
                'amount' => number_format($amount / 100, 2, '.', ''),
                'status' => 'initiating',
                'initiated_at' => now(),
            ]);
        });

        if ($attempt->status === 'pending') {
            return $this->redirectUrl($attempt);
        }

        try {
            $result = $this->gateway->initiate($attempt, $booking);
        } catch (Throwable $exception) {
            Log::warning('ekPay initiation failed.', ['exception' => $exception::class]);
            $result = null;
        }

        if (! $result) {
            $attempt->update(['status' => 'failed']);
            abort(503, 'Payment gateway is unavailable. Your booking has not been charged.');
        }

        $attempt->update([
            'secure_token' => $result['token'],
            'expires_at' => now()->addMinutes(25),
            'status' => 'pending',
        ]);

        return $result['url'];
    }

    public function reconcile(PaymentAttempt $attempt): string
    {
        if ($attempt->status === 'paid') {
            return 'paid';
        }
        if (! $this->gateway->configured()) {
            return 'pending';
        }

        try {
            $result = $this->gateway->search($attempt);
        } catch (Throwable $exception) {
            Log::warning('ekPay transaction search failed.', ['exception' => $exception::class]);
            return 'pending';
        }
        if (! $result) {
            return 'pending';
        }

        $code = (string) ($result['msg_code'] ?? '');
        if ($code !== '1020') {
            if (in_array($code, ['1021', '1022'], true)) {
                $attempt->update(['status' => $code === '1022' ? 'cancelled' : 'failed']);
            }
            return $attempt->status;
        }

        $info = $result['trnx_info'] ?? [];
        $merchant = $result['basic_Info']['mer_reg_id'] ?? null;
        if ($merchant !== config('services.ekpay.merchant_id')
            || ($info['mer_trnx_id'] ?? null) !== $attempt->transaction_id
            || ($info['curr'] ?? null) !== 'BDT'
            || ! isset($info['trnx_amt'])
            || self::cents($info['trnx_amt']) !== self::cents($attempt->amount)) {
            Log::warning('ekPay transaction verification mismatch.', ['attempt_id' => $attempt->id]);
            return 'pending';
        }

        DB::transaction(function () use ($attempt, $info) {
            $locked = PaymentAttempt::whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === 'paid') {
                return;
            }
            $booking = Booking::whereKey($locked->booking_id)->lockForUpdate()->firstOrFail();
            $paid = self::cents($booking->paid_amount) + self::cents($locked->amount);
            $total = self::cents($booking->total_amount);
            if ($paid > $total) {
                Log::error('ekPay payment exceeds booking total; manual reconciliation required.', ['attempt_id' => $locked->id]);
                return;
            }

            PaymentReceipts::preserveLegacy($booking);
            $previousGross = in_array($booking->payment?->status, ['paid', 'refunded'], true) ? (float) $booking->payment->amount : 0;
            $gross = $previousGross + (float) $locked->amount;
            $locked->update([
                'status' => 'paid',
                'verified_at' => now(),
                'gateway_transaction_id' => (string) ($info['trnx_id'] ?? ''),
                'secure_token' => null,
            ]);
            $payment = $booking->payment()->updateOrCreate(['booking_id' => $booking->id], [
                'payment_method' => 'ekPay',
                'transaction_id' => $locked->transaction_id,
                'amount' => number_format($gross, 2, '.', ''),
                'status' => 'paid',
                'gateway_response' => ['provider' => 'ekPay', 'last_attempt_id' => $locked->id],
                'paid_at' => now(),
            ]);
            PaymentReceipts::record($booking, $payment, (float) $locked->amount, 'ekpay:'.$locked->id, 'ekpay');
            $booking->update([
                'paid_amount' => number_format($paid / 100, 2, '.', ''),
                'due_amount' => number_format(($total - $paid) / 100, 2, '.', ''),
                'payment_option' => $paid < $total ? 'advance' : 'full',
                'status' => $booking->status === 'cancelled' ? 'cancelled' : 'confirmed',
            ]);
        });

        return $attempt->fresh()->status;
    }

    private function redirectUrl(PaymentAttempt $attempt): string
    {
        return rtrim(config('services.ekpay.base_url'), '/').'/v1?'.http_build_query([
            'sToken' => $attempt->secure_token,
            'trnsID' => $attempt->transaction_id,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public static function cents(string|int|float $amount): int
    {
        $value = (string) $amount;
        if (! preg_match('/^\d{1,10}(?:\.\d{1,2})?$/', $value)) {
            return -1;
        }
        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');
        return (int) $whole * 100 + (int) str_pad($fraction, 2, '0');
    }
}
