<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CentreDecoratorsTest extends TestCase
{
    use RefreshDatabase;

    private function centre(User $owner, string $slug): CommunityCentre
    {
        return CommunityCentre::create([
            'owner_id' => $owner->id,
            'name' => Str::headline($slug),
            'slug' => $slug,
            'area' => 'Wari',
            'capacity' => 100,
            'base_price' => 1000,
            'half_day_price' => 1000,
            'full_day_price' => 2000,
            'status' => 'active',
        ]);
    }

    public function test_owner_manages_only_own_centre_decorators_and_public_sees_active_contacts(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $other = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $customer = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $centre = $this->centre($owner, 'owner-centre');
        $otherCentre = $this->centre($other, 'other-centre');
        $payload = [
            'centre_id' => $centre->id,
            'name' => 'Wari Decorators',
            'phone' => '01711111111',
            'service_area' => 'Wari and nearby areas',
            'address' => 'Wari, Dhaka',
            'description' => 'Stage and lighting.',
            'status' => 'active',
        ];

        $this->withToken($customer->api_token)->postJson('/api/owner/decorators', $payload)->assertForbidden();
        $this->withToken($owner->api_token)->postJson('/api/owner/decorators', [
            ...$payload, 'centre_id' => $otherCentre->id,
        ])->assertForbidden();
        $this->withToken($owner->api_token)->postJson('/api/owner/decorators', [
            ...$payload, 'phone' => 'not-a-phone',
        ])->assertUnprocessable();

        $id = $this->withToken($owner->api_token)->postJson('/api/owner/decorators', $payload)
            ->assertCreated()->assertJsonPath('data.name', 'Wari Decorators')->json('data.id');
        $this->withToken($owner->api_token)->getJson('/api/owner/decorators')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonCount(1, 'centres');
        $this->withToken($other->api_token)->getJson('/api/owner/decorators')
            ->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/centres/owner-centre')->assertOk()
            ->assertJsonPath('data.decorators.0.phone', '01711111111')
            ->assertJsonPath('data.decorators.0.service_area', 'Wari and nearby areas');
        $this->getJson('/api/centres/other-centre')->assertJsonCount(0, 'data.decorators');

        $this->withToken($other->api_token)->putJson("/api/owner/decorators/{$id}", $payload)->assertForbidden();
        $this->withToken($other->api_token)->deleteJson("/api/owner/decorators/{$id}")->assertForbidden();
        $this->withToken($owner->api_token)->putJson("/api/owner/decorators/{$id}", [
            ...$payload, 'centre_id' => $otherCentre->id,
        ])->assertForbidden();
        $this->withToken($owner->api_token)->putJson("/api/owner/decorators/{$id}", [
            ...$payload, 'status' => 'inactive',
        ])->assertOk()->assertJsonPath('data.status', 'inactive');
        $this->getJson('/api/centres/owner-centre')->assertJsonCount(0, 'data.decorators');
        $this->withToken($owner->api_token)->deleteJson("/api/owner/decorators/{$id}")->assertOk();
        $this->assertDatabaseMissing('centre_decorators', ['id' => $id]);
    }

    public function test_customer_can_only_select_a_decorator_from_the_booked_centre_and_contact_is_snapshotted(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $customer = User::factory()->create(['role' => 'customer', 'phone' => '01812345678', 'api_token' => Str::random(72)]);
        $centre = $this->centre($owner, 'booking-centre');
        $otherCentre = $this->centre($owner, 'another-centre');
        $create = fn ($centreId, $name) => $this->withToken($owner->api_token)
            ->postJson('/api/owner/decorators', [
                'centre_id' => $centreId,
                'name' => $name,
                'phone' => '01711111111',
                'service_area' => 'Wari',
                'status' => 'active',
            ])->assertCreated()->json('data.id');

        $selectedId = $create($centre->id, 'Selected Decorator');
        $otherId = $create($otherCentre->id, 'Other Decorator');
        $payload = [
            'centre_slug' => $centre->slug,
            'event_date' => now()->addDays(10)->toDateString(),
            'session_type' => 'full_day',
            'guest_count' => 50,
            'nid_number' => '3216549870',
        ];

        $this->withToken($customer->api_token)->postJson('/api/bookings', [
            ...$payload, 'decorator_id' => $otherId,
        ])->assertUnprocessable()->assertJsonValidationErrors('decorator_id');
        $this->assertDatabaseCount('bookings', 0);

        $bookingNo = $this->withToken($customer->api_token)->postJson('/api/bookings', [
            ...$payload, 'decorator_id' => $selectedId,
        ])->assertCreated()->assertJsonPath('data.decorator_name', 'Selected Decorator')
            ->assertJsonPath('data.decorator_phone', '01711111111')
            ->json('data.booking_no');

        $this->withToken($owner->api_token)->deleteJson("/api/owner/decorators/{$selectedId}")->assertOk();
        $this->withToken($customer->api_token)->getJson("/api/bookings/{$bookingNo}")
            ->assertOk()->assertJsonPath('data.decorator_name', 'Selected Decorator')
            ->assertJsonPath('data.decorator_phone', '01711111111');
    }
}
