<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class VirtualTourTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_tour_url_is_returned_on_the_public_centre_page_and_can_be_cleared(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $centre = CommunityCentre::create([
            'owner_id' => $owner->id,
            'name' => 'Tour Centre',
            'slug' => 'tour-centre',
            'area' => 'Dhaka',
            'capacity' => 300,
            'half_day_price' => 20000,
            'full_day_price' => 35000,
            'status' => 'active',
        ]);

        $this->getJson("/api/centres/{$centre->slug}")
            ->assertOk()
            ->assertJsonPath('data.virtual_tour_url', null);

        $this->withToken($owner->api_token)
            ->patchJson('/api/owner/profile', ['virtual_tour_url' => 'https://example.com/360/centre?view=main'])
            ->assertOk()
            ->assertJsonPath('data.virtual_tour_url', 'https://example.com/360/centre?view=main');

        $this->getJson("/api/centres/{$centre->slug}")
            ->assertOk()
            ->assertJsonPath('data.virtual_tour_url', 'https://example.com/360/centre?view=main');

        $this->withToken($owner->api_token)
            ->patchJson('/api/owner/profile', ['virtual_tour_url' => null])
            ->assertOk();

        $this->getJson("/api/centres/{$centre->slug}")
            ->assertOk()
            ->assertJsonPath('data.virtual_tour_url', null);
    }

    public function test_owner_cannot_save_non_web_or_oversized_tour_urls(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        CommunityCentre::create([
            'owner_id' => $owner->id,
            'name' => 'Tour Centre',
            'slug' => 'tour-centre',
            'area' => 'Dhaka',
            'capacity' => 300,
            'half_day_price' => 20000,
            'full_day_price' => 35000,
            'status' => 'active',
        ]);

        foreach (['javascript:alert(1)', 'ftp://example.com/tour', 'https://example.com/'.str_repeat('a', 240)] as $url) {
            $this->withToken($owner->api_token)
                ->patchJson('/api/owner/profile', ['virtual_tour_url' => $url])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('virtual_tour_url');
        }
    }
}
