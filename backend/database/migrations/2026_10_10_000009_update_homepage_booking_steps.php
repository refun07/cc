<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $setting = DB::table('app_settings')->where('key', 'homepage_content')->first();
        $content = json_decode((string) ($setting->value ?? ''), true);
        if (! is_array($content) || ! is_array($content['steps'] ?? null)) {
            return;
        }

        $replacements = [
            'Browse & filter|Search verified centres by area, date, capacity and budget.' => ['title' => 'Browse centres', 'description' => 'Search by area and capacity; compare reviews and decorator contacts.'],
            'Pick date & session|Choose a date, floor and full or half-day session.' => ['title' => 'Sign in by phone', 'description' => 'Register with an SMS code or sign in using your mobile number.'],
            'Review & pay|See a transparent breakdown with VAT, then pay locally.' => ['title' => 'Choose your booking', 'description' => 'Pick date, floor and session; add guests and organiser details. NID is needed only on your first booking.'],
            'Get confirmed|Receive a booking number and track your event status.' => ['title' => 'Review & reserve', 'description' => 'Check charges, choose pay later or online payment when available, then track your booking.'],
        ];

        foreach ($content['steps'] as &$step) {
            $key = ($step['title'] ?? '').'|'.($step['description'] ?? '');
            if (isset($replacements[$key])) {
                $step = $replacements[$key];
            }
        }
        unset($step);

        DB::table('app_settings')->where('key', 'homepage_content')->update(['value' => json_encode($content)]);
    }

    public function down(): void
    {
        // Admin-authored homepage content is never reversed automatically.
    }
};
