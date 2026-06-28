<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use App\Models\WasteStream;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class WastePartnerPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_waste_partners_can_access_partner_routes(): void
    {
        $customer = User::factory()->create([
            'role' => 'customer',
            'status' => 'active',
            'phone' => '01800000001',
            'api_token' => Str::random(72),
        ]);

        $this->withToken($customer->api_token)
            ->getJson('/api/partner/dashboard')
            ->assertForbidden();
    }

    public function test_partner_can_see_and_claim_an_available_pickup(): void
    {
        [$partner, $waste] = $this->partnerAndWaste();

        $this->withToken($partner->api_token)
            ->getJson('/api/partner/pickups?scope=available')
            ->assertOk()
            ->assertJsonPath('data.0.id', $waste->id)
            ->assertJsonPath('data.0.centre.name', 'Test Community Centre');

        $scheduled = now()->addDay()->startOfHour();
        $this->withToken($partner->api_token)
            ->postJson("/api/partner/pickups/{$waste->id}/claim", [
                'pickup_scheduled_for' => $scheduled->toIso8601String(),
                'partner_notes' => 'Truck 2 will collect from the rear gate.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'pickup_assigned')
            ->assertJsonPath('data.partner_notes', 'Truck 2 will collect from the rear gate.');

        $this->assertDatabaseHas('waste_streams', [
            'id' => $waste->id,
            'assigned_partner_id' => $partner->id,
        ]);
    }

    public function test_dashboard_keeps_weight_and_item_impact_units_separate(): void
    {
        [$partner, $waste] = $this->partnerAndWaste();
        $waste->update(['assigned_partner_id' => $partner->id, 'status' => 'recycled']);
        WasteStream::create([
            'centre_id' => $waste->centre_id,
            'assigned_partner_id' => $partner->id,
            'waste_type' => 'Reusable decorations',
            'quantity' => 12,
            'unit' => 'pcs',
            'status' => 'returned_to_inventory',
        ]);

        $this->withToken($partner->api_token)
            ->getJson('/api/partner/dashboard')
            ->assertOk()
            ->assertJsonPath('stats.total_diverted', 25)
            ->assertJsonPath('stats.items_recovered', 12);
    }

    public function test_partner_must_complete_pickup_stages_in_order(): void
    {
        [$partner, $waste] = $this->partnerAndWaste();
        $waste->update(['assigned_partner_id' => $partner->id]);

        $this->withToken($partner->api_token)
            ->patchJson("/api/partner/pickups/{$waste->id}/status", ['status' => 'recycled'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->withToken($partner->api_token)
            ->patchJson("/api/partner/pickups/{$waste->id}/status", ['status' => 'collected'])
            ->assertOk()
            ->assertJsonPath('data.status', 'collected');

        $this->withToken($partner->api_token)
            ->patchJson("/api/partner/pickups/{$waste->id}/status", ['status' => 'recycled'])
            ->assertOk()
            ->assertJsonPath('data.status', 'recycled');

        $this->assertNotNull($waste->fresh()->processed_at);
    }

    public function test_partner_cannot_update_another_partners_pickup(): void
    {
        [$partner, $waste] = $this->partnerAndWaste();
        $other = User::factory()->create([
            'role' => 'waste_partner',
            'status' => 'active',
            'phone' => '01900000002',
            'api_token' => Str::random(72),
        ]);
        $waste->update(['assigned_partner_id' => $other->id]);

        $this->withToken($partner->api_token)
            ->patchJson("/api/partner/pickups/{$waste->id}/status", ['status' => 'collected'])
            ->assertForbidden();
    }

    private function partnerAndWaste(): array
    {
        $partner = User::factory()->create([
            'role' => 'waste_partner',
            'status' => 'active',
            'phone' => '01900000001',
            'api_token' => Str::random(72),
        ]);
        $centre = CommunityCentre::create([
            'name' => 'Test Community Centre',
            'slug' => 'test-community-centre',
            'area' => 'Dhanmondi',
            'address' => 'Road 7, Dhanmondi, Dhaka',
        ]);
        $waste = WasteStream::create([
            'centre_id' => $centre->id,
            'waste_type' => 'Organic food waste',
            'quantity' => 25,
            'unit' => 'kg',
            'status' => 'pickup_assigned',
            'notes' => 'Collect from service entrance.',
        ]);

        return [$partner, $waste];
    }
}
