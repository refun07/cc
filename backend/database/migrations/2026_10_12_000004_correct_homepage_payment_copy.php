<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $setting = DB::table('app_settings')->where('key', 'homepage_content')->first();
        $content = json_decode((string) ($setting->value ?? ''), true);
        if (! is_array($content) || ! is_array($content['features'] ?? null)) {
            return;
        }

        $old = 'bKash, Nagad, Rocket, Upay, SSLCommerz, card & bank transfer.';
        $new = 'Available online payment methods are shown on the ekPay checkout page.';
        $changed = false;
        foreach ($content['features'] as &$feature) {
            if (($feature['description'] ?? null) === $old) {
                $feature['description'] = $new;
                $changed = true;
            }
        }
        unset($feature);

        if ($changed) {
            DB::table('app_settings')->where('key', 'homepage_content')->update(['value' => json_encode($content)]);
        }
    }

    public function down(): void
    {
        // Admin-edited homepage copy is not reverted.
    }
};
