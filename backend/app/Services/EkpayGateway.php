<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\PaymentAttempt;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EkpayGateway
{
    public function configured(): bool
    {
        $id = config('services.ekpay.merchant_id');
        $password = config('services.ekpay.password');
        $base = rtrim((string) config('services.ekpay.base_url'), '/');
        $host = parse_url($base, PHP_URL_HOST);

        return filled($id) && filled($password)
            && parse_url($base, PHP_URL_SCHEME) === 'https'
            && is_string($host)
            && ($host === 'ekpay.gov.bd' || str_ends_with($host, '.ekpay.gov.bd'))
            && (! str_ends_with($id, '_test') || $host !== 'pg.ekpay.gov.bd')
            && (! str_ends_with($id, '_test') || filled(config('services.ekpay.mac_addr')))
            && (! app()->environment('production') || parse_url(config('app.url'), PHP_URL_SCHEME) === 'https')
            && parse_url($base, PHP_URL_PATH) === '/ekpaypg';
    }

    public function availableTo(?User $user): bool
    {
        if (! $this->configured()) {
            return false;
        }

        $host = parse_url((string) config('services.ekpay.base_url'), PHP_URL_HOST);
        if (! app()->environment('production') || $host === 'pg.ekpay.gov.bd') {
            return true;
        }

        $testerPhone = config('services.ekpay.sandbox_tester_phone');

        return is_string($testerPhone)
            && preg_match('/^01[0-9]{9}$/', $testerPhone)
            && $user?->role === 'customer'
            && $user->status === 'active'
            && hash_equals($testerPhone, (string) $user->phone);
    }

    public function initiate(PaymentAttempt $attempt, Booking $booking): ?array
    {
        $base = rtrim(config('services.ekpay.base_url'), '/');
        $callback = rtrim(config('app.url'), '/').'/api/payments/ekpay';
        $body = [
            'mer_info' => [
                'mer_reg_id' => config('services.ekpay.merchant_id'),
                'mer_pas_key' => config('services.ekpay.password'),
            ],
            'req_timestamp' => now('Asia/Dhaka')->format('Y-m-d H:i:s').' GMT+6',
            'feed_uri' => [
                's_uri' => $callback.'/return/success?trnsId='.$attempt->transaction_id,
                'f_uri' => $callback.'/return/failure?trnsId='.$attempt->transaction_id,
                'c_uri' => $callback.'/return/cancel?trnsId='.$attempt->transaction_id,
            ],
            'cust_info' => [
                'cust_id' => (string) $booking->user_id,
                'cust_name' => $booking->customer_name,
                'cust_mobo_no' => '+88'.$booking->customer_phone,
                'cust_email' => '',
                'cust_mail_addr' => '',
            ],
            'trns_info' => [
                'trnx_id' => $attempt->transaction_id,
                'trnx_amt' => $attempt->amount,
                'trnx_currency' => 'BDT',
                'ord_id' => $booking->booking_no,
                'ord_det' => 'ICCMS community centre booking '.$booking->booking_no,
            ],
            'ipn_info' => [
                'ipn_channel' => '3',
                'ipn_email' => '',
                'ipn_uri' => $callback.'/ipn',
            ],
            'mac_addr' => config('services.ekpay.mac_addr'),
        ];

        $response = Http::acceptJson()->timeout(12)->post($base.'/v1/merchant-api', $body);
        $token = $response->json('secure_token');
        if (! $response->successful() || ! is_string($token) || ! preg_match('/^[A-Za-z0-9._-]{20,4096}$/', $token)) {
            Log::warning('ekPay initiation rejected.', [
                'http_status' => $response->status(),
                'code' => $response->json('responseCode') ?? $response->json('msg_code'),
            ]);
            return null;
        }

        return [
            'token' => $token,
            'url' => $base.'/v1?'.http_build_query([
                'sToken' => $token,
                'trnsID' => $attempt->transaction_id,
            ], '', '&', PHP_QUERY_RFC3986),
        ];
    }

    public function search(PaymentAttempt $attempt): ?array
    {
        $response = Http::acceptJson()->timeout(12)->post(
            rtrim(config('services.ekpay.base_url'), '/').'/v1/search-transaction',
            [
                'username' => config('services.ekpay.merchant_id'),
                'trnx_id' => $attempt->transaction_id,
                'trans_date' => $attempt->initiated_at->timezone('Asia/Dhaka')->toDateString(),
            ]
        );

        return $response->successful() && is_array($response->json()) ? $response->json() : null;
    }
}
