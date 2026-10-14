<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $setting = DB::table('app_settings')->where('key', 'homepage_content')->first();
        $content = json_decode((string) ($setting->value ?? ''), true);
        if (! is_array($content)) {
            return;
        }

        $subtitle = $content['hero']['subtitle'] ?? null;
        if (is_string($subtitle) && str_contains($subtitle, 'with food menus, local payments')) {
            $content['hero']['subtitle'] = str_replace('with food menus, local payments', 'with decorator contacts, local payments', $subtitle);
        }
        if (isset($content['features']) && is_array($content['features'])) {
            foreach ($content['features'] as &$feature) {
                if (($feature['title'] ?? null) === 'Food Menus'
                    && ($feature['description'] ?? null) === 'Bangla, premium wedding, corporate or vegetarian packages.') {
                    $feature = ['icon' => 'Phone', 'title' => 'Decorator Contact', 'description' => 'Find the decorator contact for your chosen centre.'];
                }
            }
            unset($feature);
        }
        if (isset($content['steps']) && is_array($content['steps'])) {
            foreach ($content['steps'] as &$step) {
                if (($step['title'] ?? null) === 'Pick session & menu'
                    && ($step['description'] ?? null) === 'Choose full or half day and a food package for your guests.') {
                    $step = ['title' => 'Pick date & session', 'description' => 'Choose a date, floor and full or half-day session.'];
                }
            }
            unset($step);
        }

        DB::table('app_settings')->where('key', 'homepage_content')->update(['value' => json_encode($content)]);
    }

    public function down(): void
    {
        // Edited CMS copy is not reversed automatically.
    }
};
