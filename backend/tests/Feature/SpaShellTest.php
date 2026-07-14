<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SpaShellTest extends TestCase
{
    #[DataProvider('spaRouteProvider')]
    public function test_spa_links_serve_a_non_cacheable_shell(string $url): void
    {
        $originalPublicPath = app()->publicPath();
        $testPublicPath = storage_path('framework/testing-public-'.Str::uuid());

        File::ensureDirectoryExists($testPublicPath.'/app');
        File::put($testPublicPath.'/app/index.html', '<!doctype html><div id="root"></div>');
        app()->usePublicPath($testPublicPath);

        try {
            $response = $this->get($url);

            $response->assertOk()
                ->assertSee('<div id="root"></div>', false)
                ->assertHeader('Pragma', 'no-cache')
                ->assertHeader('Expires', '0');

            $cacheControl = $response->headers->get('Cache-Control');
            $this->assertStringContainsString('no-store', $cacheControl);
            $this->assertStringContainsString('no-cache', $cacheControl);
            $this->assertStringContainsString('must-revalidate', $cacheControl);
            $this->assertStringNotContainsString('public', $cacheControl);
        } finally {
            app()->usePublicPath($originalPublicPath);
            File::deleteDirectory($testPublicPath);
        }
    }

    public static function spaRouteProvider(): array
    {
        return [
            'home' => ['/'],
            'centre listing' => ['/centres'],
            'centre detail' => ['/centres/dhanmondi-community-centre'],
            'checkout' => ['/checkout'],
            'booking result' => ['/booking/DSCC-TEST'],
            'customer account' => ['/my-bookings'],
            'owner portal' => ['/owner/bookings'],
            'admin portal' => ['/admin/centres'],
            'staff portal' => ['/staff'],
            'partner portal' => ['/partner/pickups'],
        ];
    }
}
