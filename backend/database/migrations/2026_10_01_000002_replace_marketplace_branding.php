<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $setting = DB::table('app_settings')->where('key', 'homepage_content')->first();
        $content = json_decode((string) ($setting?->value ?? ''), true);
        if (! is_array($content)) {
            return;
        }

        $changed = false;
        $replacements = [
            'hero' => [
                'badge' => ['Dhaka South City Corporation · Official Marketplace', 'ICCMS · DSCC'],
            ],
            'features_subheading' => [
                'One marketplace serving citizens, centre owners and ICCMS admin.',
                'ICCMS serves citizens, centre owners and DSCC administrators.',
            ],
        ];

        foreach ($replacements as $key => $replacement) {
            if ($key === 'hero') {
                [$old, $new] = $replacement['badge'];
                if (($content['hero']['badge'] ?? null) === $old) {
                    $content['hero']['badge'] = $new;
                    $changed = true;
                }
            } elseif (($content[$key] ?? null) === $replacement[0]) {
                $content[$key] = $replacement[1];
                $changed = true;
            }
        }

        if ($changed) {
            DB::table('app_settings')->where('id', $setting->id)->update([
                'value' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }
    }

    public function down(): void
    {
        // Do not overwrite later homepage edits.
    }
};
