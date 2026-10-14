<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class BulkSmsBd
{
    public function sendOtp(string $phone, string $code): bool
    {
        $key = config('services.bulksmsbd.api_key');
        $sender = config('services.bulksmsbd.sender_id');

        if (! $key || ! $sender) {
            Log::warning('BULKSMSBD OTP delivery is not configured.');
            return false;
        }

        try {
            $response = Http::timeout(10)->asForm()->post('https://bulksmsbd.net/api/smsapi', [
                'api_key' => $key,
                'type' => 'text',
                'senderid' => $sender,
                'number' => '88'.$phone,
                'message' => "Your ICCMS OTP is {$code}",
            ]);

            if ($response->successful() && (string) $response->json('response_code') === '202') {
                return true;
            }
            Log::warning('BULKSMSBD rejected an OTP request.', [
                'http_status' => $response->status(),
                'response_code' => $response->json('response_code'),
            ]);
        } catch (Throwable $exception) {
            // Keep gateway credentials and OTPs out of logs.
            Log::warning('BULKSMSBD OTP request failed.', ['exception' => $exception::class]);
        }
        return false;
    }
}
