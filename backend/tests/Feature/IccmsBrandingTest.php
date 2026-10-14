<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IccmsBrandingTest extends TestCase
{
    use RefreshDatabase;

    public function test_rebrand_updates_legacy_display_content_without_changing_other_values(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'name' => 'DSCC Admin']);
        $owner = User::factory()->create(['role' => 'owner']);
        $centre = CommunityCentre::create([
            'owner_id' => $owner->id,
            'name' => 'Test Centre',
            'slug' => 'test-centre',
            'area' => 'Dhaka',
            'capacity' => 100,
            'base_price' => 100,
            'half_day_price' => 100,
            'full_day_price' => 200,
            'booking_prefix' => 'DSCC',
            'description' => 'A verified DSCC centre with a custom detail.',
            'status' => 'active',
        ]);
        AppSetting::put('homepage_content', json_encode([
            'hero' => ['subtitle' => 'Book DSCC centres', 'title_lead' => 'Custom title'],
            'features' => [['title' => 'DSCC Verified', 'description' => 'Custom detail']],
        ]));

        $migration = require database_path('migrations/2026_10_01_000001_rebrand_iccms_display_content.php');
        $migration->up();
        $migration->up();

        $this->assertSame('ICCMS Admin', $admin->fresh()->name);
        $this->assertSame('ICCMS', $centre->fresh()->booking_prefix);
        $this->assertSame('A verified ICCMS centre with a custom detail.', $centre->fresh()->description);
        $content = json_decode(AppSetting::get('homepage_content'), true);
        $this->assertSame('Book ICCMS centres', $content['hero']['subtitle']);
        $this->assertSame('Custom title', $content['hero']['title_lead']);
        $this->assertSame('ICCMS Verified', $content['features'][0]['title']);
        $this->assertSame('ICCMS', CommunityCentre::make()->booking_prefix);
    }

    public function test_marketplace_copy_is_updated_without_overwriting_custom_homepage_fields(): void
    {
        AppSetting::put('homepage_content', json_encode([
            'hero' => [
                'badge' => 'Dhaka South City Corporation · Official Marketplace',
                'title_lead' => 'Custom title',
            ],
            'features_subheading' => 'One marketplace serving citizens, centre owners and ICCMS admin.',
            'steps_heading' => 'Custom steps',
        ]));

        $migration = require database_path('migrations/2026_10_01_000002_replace_marketplace_branding.php');
        $migration->up();
        $migration->up();

        $content = json_decode(AppSetting::get('homepage_content'), true);
        $this->assertSame('ICCMS · DSCC', $content['hero']['badge']);
        $this->assertSame('ICCMS serves citizens, centre owners and DSCC administrators.', $content['features_subheading']);
        $this->assertSame('Custom title', $content['hero']['title_lead']);
        $this->assertSame('Custom steps', $content['steps_heading']);
    }

    public function test_food_menu_copy_is_replaced_without_overwriting_custom_sections(): void
    {
        AppSetting::put('homepage_content', json_encode([
            'hero' => [
                'subtitle' => 'Book ICCMS centres with food menus, local payments and more.',
                'title_lead' => 'Custom title',
            ],
            'features' => [
                ['title' => 'Food Menus', 'description' => 'Bangla, premium wedding, corporate or vegetarian packages.'],
                ['title' => 'Food Menus', 'description' => 'A custom administrator description.'],
            ],
            'steps' => [
                ['title' => 'Pick session & menu', 'description' => 'Choose full or half day and a food package for your guests.'],
            ],
        ]));

        $migration = require database_path('migrations/2026_10_10_000005_remove_food_menu_homepage_copy.php');
        $migration->up();
        $migration->up();

        $content = json_decode(AppSetting::get('homepage_content'), true);
        $this->assertSame('Book ICCMS centres with decorator contacts, local payments and more.', $content['hero']['subtitle']);
        $this->assertSame('Custom title', $content['hero']['title_lead']);
        $this->assertSame('Decorator Contact', $content['features'][0]['title']);
        $this->assertSame('A custom administrator description.', $content['features'][1]['description']);
        $this->assertSame('Pick date & session', $content['steps'][0]['title']);
    }

    public function test_booking_steps_update_only_shipped_copy(): void
    {
        AppSetting::put('homepage_content', json_encode([
            'steps' => [
                ['title' => 'Browse & filter', 'description' => 'Search verified centres by area, date, capacity and budget.'],
                ['title' => 'Pick date & session', 'description' => 'Choose a date, floor and full or half-day session.'],
                ['title' => 'Custom step', 'description' => 'Admin-written instructions.'],
            ],
        ]));

        $migration = require database_path('migrations/2026_10_10_000009_update_homepage_booking_steps.php');
        $migration->up();
        $migration->up();

        $content = json_decode(AppSetting::get('homepage_content'), true);
        $this->assertSame('Browse centres', $content['steps'][0]['title']);
        $this->assertSame('Sign in by phone', $content['steps'][1]['title']);
        $this->assertSame('Admin-written instructions.', $content['steps'][2]['description']);
    }
}
