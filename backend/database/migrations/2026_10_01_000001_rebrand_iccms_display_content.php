<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'admin')
            ->where('name', 'DSCC Admin')
            ->update(['name' => 'ICCMS Admin']);

        DB::table('community_centres')
            ->where('booking_prefix', 'DSCC')
            ->update(['booking_prefix' => 'ICCMS']);

        DB::table('community_centres')
            ->select('id', 'description')
            ->where('description', 'like', '%DSCC%')
            ->orderBy('id')
            ->chunkById(100, function ($centres): void {
                foreach ($centres as $centre) {
                    DB::table('community_centres')->where('id', $centre->id)->update([
                        'description' => str_replace('DSCC', 'ICCMS', $centre->description),
                    ]);
                }
            });

        $setting = DB::table('app_settings')->where('key', 'homepage_content')->first();
        $content = json_decode((string) ($setting?->value ?? ''), true);
        if (! is_array($content)) {
            return;
        }

        $changed = false;
        array_walk_recursive($content, static function (&$value) use (&$changed): void {
            if (! is_string($value)) {
                return;
            }
            $rebranded = str_replace(['DSCC', 'ডিএসসিসি'], 'ICCMS', $value);
            if ($rebranded !== $value) {
                $value = $rebranded;
                $changed = true;
            }
        });

        if ($changed) {
            DB::table('app_settings')->where('id', $setting->id)->update([
                'value' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }
    }

    public function down(): void
    {
        // Existing booking references and later admin edits must not be rewritten.
    }
};
