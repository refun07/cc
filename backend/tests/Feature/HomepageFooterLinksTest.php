<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\HomepageContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class HomepageFooterLinksTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_public_city_links_without_unsafe_urls(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $default = HomepageContent::defaults();

        $this->getJson('/api/homepage')->assertOk()
            ->assertJsonPath('data.footer_links.0.url', 'https://dscc.gov.bd/')
            ->assertJsonPath('data.footer_links.0.label_bn', 'ঢাকা দক্ষিণ সিটি করপোরেশন');
        $this->withToken($owner->api_token)->patchJson('/api/admin/homepage', $default)->assertForbidden();

        $unsafe = $default;
        $unsafe['footer_links'] = [['label' => 'Unsafe', 'url' => 'javascript:alert(1)']];
        $this->withToken($admin->api_token)->patchJson('/api/admin/homepage', $unsafe)
            ->assertUnprocessable()->assertJsonValidationErrors(['footer_links.0.url']);

        $updated = $default;
        $updated['footer_links'] = [['label' => 'Citizen services', 'label_bn' => 'নাগরিক সেবা', 'url' => 'https://dscc.gov.bd/services']];
        $this->withToken($admin->api_token)->patchJson('/api/admin/homepage', $updated)
            ->assertOk()->assertJsonPath('data.footer_links.0.label', 'Citizen services')
            ->assertJsonPath('data.footer_links.0.label_bn', 'নাগরিক সেবা');
        $this->getJson('/api/homepage')->assertJsonPath('data.footer_links.0.url', 'https://dscc.gov.bd/services');

        $updated['footer_links'] = [];
        $this->withToken($admin->api_token)->patchJson('/api/admin/homepage', $updated)
            ->assertOk()->assertJsonPath('data.footer_links', []);
        $this->getJson('/api/homepage')->assertJsonPath('data.footer_links', []);
    }
}
