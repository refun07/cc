<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Document scanning (NID / ledger / invoice OCR). Gemini has a free tier and
    // takes priority; Anthropic is used only if no Gemini key is set.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),
    ],

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
    ],

    'bulksmsbd' => [
        'api_key' => env('BULKSMSBD_API_KEY'),
        'sender_id' => env('BULKSMSBD_SENDER_ID'),
    ],

    'ekpay' => [
        'merchant_id' => env('EKPAY_MERCHANT_ID'),
        'password' => env('EKPAY_PASSWORD'),
        'base_url' => env('EKPAY_BASE_URL'),
        'mac_addr' => env('EKPAY_MAC_ADDR'),
        'sandbox_tester_phone' => env('EKPAY_SANDBOX_TESTER_PHONE'),
    ],

];
