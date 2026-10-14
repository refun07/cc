<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminCreatePermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_roles_still_require_their_own_centre_assignments(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $payload = [
            'name' => 'Assignment Test', 'phone' => '01755555556',
            'password' => 'test-password', 'status' => 'active',
            'centre_ids' => [], 'coordinator_permissions' => [],
            'caretaker_centre_id' => null,
        ];
        $this->withToken($admin->api_token)
            ->postJson('/api/admin/users', [...$payload, 'role' => 'caretaker'])
            ->assertUnprocessable()->assertJsonValidationErrors('centre_ids');
        $this->postJson('/api/admin/users', [...$payload, 'role' => 'project_coordinator'])
            ->assertUnprocessable()->assertJsonValidationErrors('centre_ids');
        $this->assertDatabaseMissing('users', ['phone' => $payload['phone']]);
    }

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
                'centre_ids' => [],
                'coordinator_permissions' => ['centres.view', 'bookings.view'],
                'caretaker_centre_id' => null,
                'area_scope' => '',
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
                'decorator_name' => 'Local Decorators',
                'decorator_phone' => '01712345678',
                'status' => 'active',
            ])
            ->assertCreated()
            ->assertJsonPath('data.owner_id', $ownerId)
            ->assertJsonPath('data.slug', 'admin-created-centre')
            ->assertJsonPath('data.is_verified', true);

        $centre = CommunityCentre::where('slug', 'admin-created-centre')->firstOrFail();
        $this->withToken($admin->api_token)->patchJson("/api/admin/centres/{$centre->id}/decorator", [
            'decorator_phone' => '01812345678',
        ])->assertOk()->assertJsonPath('decorator_phone', '01812345678');
        $this->getJson('/api/centres/admin-created-centre')
            ->assertOk()->assertJsonPath('data.decorator_phone', '01812345678')
            ->assertJsonPath('data.decorator_name', 'Local Decorators');

        $this->withToken($admin->api_token)->patchJson("/api/admin/centres/{$centre->id}/decorator-contact", [
            'decorator_name' => 'New Decorators',
            'decorator_phone' => '01812345678',
        ])->assertOk()->assertJsonPath('data.decorator_name', 'New Decorators');
        $this->getJson('/api/centres/admin-created-centre')
            ->assertOk()->assertJsonPath('data.decorator_name', 'New Decorators');
        $this->withToken($admin->api_token)->patchJson("/api/admin/centres/{$centre->id}/decorator-contact", [
            'decorator_phone' => '123',
        ])->assertUnprocessable()->assertJsonValidationErrors('decorator_phone');

        $this->assertDatabaseHas('community_centres', [
            'owner_id' => $ownerId,
            'name' => 'Admin Created Centre',
            'slug' => 'admin-created-centre',
            'booking_prefix' => 'ACC',
            'status' => 'active',
            'is_verified' => true,
            'decorator_phone' => '01812345678',
            'decorator_name' => 'New Decorators',
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

    public function test_admin_can_create_phone_only_waste_partner(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'api_token' => Str::random(72),
        ]);

        $this->withToken($admin->api_token)
            ->postJson('/api/admin/users', [
                'name' => 'Waste Partner',
                'phone' => '01855555555',
                'password' => 'strong-pass-123',
                'role' => 'waste_partner',
                'status' => 'active',
            ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'waste_partner')
            ->assertJsonPath('data.email', null);

        $partner = User::where('phone', '01855555555')->firstOrFail();
        $this->assertNull($partner->email);
        $this->assertTrue(Hash::check('strong-pass-123', $partner->password));
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
