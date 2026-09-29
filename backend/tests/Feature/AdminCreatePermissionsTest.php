<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminCreatePermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_owner_user_and_centre(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'api_token' => Str::random(72),
        ]);

        $ownerId = $this->withToken($admin->api_token)
            ->postJson('/api/admin/users', [
                'name' => 'New Centre Owner',
                'phone' => '01755555555',
                'email' => 'new-owner@example.com',
                'password' => 'password',
                'role' => 'owner',
                'status' => 'active',
            ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'owner')
            ->assertJsonPath('data.phone', '01755555555')
            ->json('data.id');

        $this->assertDatabaseHas('users', [
            'id' => $ownerId,
            'role' => 'owner',
            'status' => 'active',
        ]);

        $this->withToken($admin->api_token)
            ->postJson('/api/admin/centres', [
                'owner_id' => $ownerId,
                'name' => 'Admin Created Centre',
                'area' => 'Dhanmondi',
                'address' => 'Dhanmondi, Dhaka',
                'description' => 'Created by the admin centre creation flow.',
                'capacity' => 600,
                'half_day_price' => 55000,
                'full_day_price' => 105000,
                'commission_rate' => 6.5,
                'booking_prefix' => 'ACC',
                'status' => 'active',
            ])
            ->assertCreated()
            ->assertJsonPath('data.owner_id', $ownerId)
            ->assertJsonPath('data.slug', 'admin-created-centre')
            ->assertJsonPath('data.is_verified', true);

        $this->assertDatabaseHas('community_centres', [
            'owner_id' => $ownerId,
            'name' => 'Admin Created Centre',
            'slug' => 'admin-created-centre',
            'booking_prefix' => 'ACC',
            'status' => 'active',
            'is_verified' => true,
        ]);
    }

    public function test_non_admin_cannot_create_admin_resources(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'api_token' => Str::random(72),
        ]);

        $this->withToken($owner->api_token)
            ->postJson('/api/admin/users', [
                'name' => 'Blocked Owner',
                'phone' => '01766666666',
                'password' => 'password',
                'role' => 'owner',
                'status' => 'active',
            ])
            ->assertForbidden();

        $this->withToken($owner->api_token)
            ->postJson('/api/admin/centres', [
                'owner_id' => $owner->id,
                'name' => 'Blocked Centre',
                'area' => 'Mirpur',
                'capacity' => 400,
                'half_day_price' => 40000,
                'full_day_price' => 80000,
                'status' => 'active',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('users', ['phone' => '01766666666']);
        $this->assertDatabaseMissing('community_centres', ['name' => 'Blocked Centre']);
    }

    public function test_admin_creation_endpoint_does_not_create_admin_accounts(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'api_token' => Str::random(72),
        ]);

        $this->withToken($admin->api_token)
            ->postJson('/api/admin/users', [
                'name' => 'Second Admin',
                'phone' => '01777777777',
                'email' => 'second-admin@example.com',
                'password' => 'password',
                'role' => 'admin',
                'status' => 'active',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertDatabaseMissing('users', ['phone' => '01777777777']);
    }

    public function test_centre_owner_must_be_an_owner_account(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'api_token' => Str::random(72),
        ]);
        $customer = User::factory()->create(['role' => 'customer']);

        $this->withToken($admin->api_token)
            ->postJson('/api/admin/centres', [
                'owner_id' => $customer->id,
                'name' => 'Invalid Owner Centre',
                'area' => 'Uttara',
                'capacity' => 300,
                'half_day_price' => 35000,
                'full_day_price' => 70000,
                'status' => 'active',
            ])
            ->assertNotFound();

        $this->assertSame(0, CommunityCentre::count());
    }
}
