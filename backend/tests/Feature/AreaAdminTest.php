<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AreaAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_area_admin_accepts_full_form_payload_with_empty_coordinator_centres(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $centre = $this->centre('Basabo', 'form-basabo');
        $centre->update(['working_area' => 'zone-1']);
        $other = $this->centre('Wari', 'form-wari');
        $other->update(['working_area' => 'zone-2']);

        $id = $this->withToken($admin->api_token)->postJson('/api/admin/users', [
            'name' => 'Area Admin Form Test', 'phone' => '01912345670',
            'password' => 'test-password', 'role' => 'area_admin',
            'area_scope' => 'zone-1', 'status' => 'active',
            'caretaker_centre_id' => null, 'centre_ids' => [],
            'coordinator_permissions' => ['centres.view', 'bookings.view'],
        ])->assertCreated()->assertJsonPath('data.area_scope', 'zone-1')->json('data.id');

        $user = User::findOrFail($id);
        $this->assertNull($user->caretaker_centre_id);
        $this->assertNull($user->coordinator_permissions);
        $this->assertCount(0, $user->coordinatorCentres);

        $token = $this->postJson('/api/auth/login', [
            'phone' => $user->phone, 'password' => 'test-password',
        ])->assertOk()->json('token');
        $this->withToken($token)->getJson('/api/area/overview')
            ->assertOk()->assertJsonCount(1, 'data.centres')
            ->assertJsonPath('data.centres.0.slug', 'form-basabo')
            ->assertDontSee('form-wari');
    }

    public function test_working_area_groups_centres_independently_of_public_area(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $basabo = $this->centre('Basabo', 'basabo-centre');
        $basabo->update(['owner_id' => $owner->id, 'working_area' => 'zone-1']);
        $wari = $this->centre('Wari', 'wari-centre');
        $wari->update(['working_area' => 'zone-1']);
        $other = $this->centre('Motijheel', 'motijheel-centre');
        $other->update(['working_area' => 'zone-2']);

        $areaAdmin = User::factory()->create([
            'role' => 'area_admin', 'area_scope' => 'zone-1', 'phone' => '01912345672', 'api_token' => Str::random(72),
        ]);
        $this->withToken($areaAdmin->api_token)->getJson('/api/area/overview')
            ->assertOk()->assertJsonCount(2, 'data.centres')
            ->assertJsonFragment(['slug' => 'basabo-centre'])
            ->assertJsonFragment(['slug' => 'wari-centre'])
            ->assertDontSee('motijheel-centre');

        $this->withToken($owner->api_token)->patchJson('/api/owner/profile', ['area' => 'South Basabo'])
            ->assertOk();
        $this->assertDatabaseHas('community_centres', [
            'id' => $basabo->id, 'area' => 'South Basabo', 'working_area' => 'zone-1',
        ]);
        $this->withToken($areaAdmin->api_token)->getJson('/api/area/overview')->assertJsonCount(2, 'data.centres');

        $this->withToken($owner->api_token)->patchJson("/api/admin/centres/{$basabo->id}/location", [
            'area' => 'Basabo', 'working_area' => 'zone-2',
        ])->assertForbidden();
        $this->withToken($admin->api_token)->patchJson("/api/admin/centres/{$basabo->id}/location", [
            'area' => 'Basabo', 'working_area' => 'zone-2',
        ])->assertOk()->assertJsonPath('data.working_area', 'zone-2');
        $this->withToken($areaAdmin->api_token)->getJson('/api/area/overview')
            ->assertJsonCount(1, 'data.centres')->assertJsonPath('data.centres.0.slug', 'wari-centre');

        $this->withToken($admin->api_token)->patchJson("/api/admin/users/{$areaAdmin->id}/area-admin", [
            'name' => $areaAdmin->name, 'phone' => $areaAdmin->phone, 'area_scope' => 'zone-2',
        ])->assertOk()->assertJsonPath('data.area_scope', 'zone-2');
        $this->withToken($areaAdmin->api_token)->getJson('/api/area/overview')
            ->assertJsonCount(2, 'data.centres');
    }

    public function test_area_admin_sees_only_assigned_area_and_cannot_use_super_admin_api(): void
    {
        $ownCentre = $this->centre('Dhanmondi', 'own-centre');
        $otherCentre = $this->centre('Wari', 'other-centre');
        $this->booking($ownCentre, 'OWN-1', 'Own Customer');
        $this->booking($otherCentre, 'OTHER-1', 'Other Customer');
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);

        $areaAdminId = $this->withToken($admin->api_token)->postJson('/api/admin/users', [
            'name' => 'Dhanmondi Area Admin',
            'phone' => '01912345678',
            'password' => 'secretpass',
            'role' => 'area_admin',
            'area_scope' => 'Dhanmondi',
            'status' => 'active',
        ])->assertCreated()->assertJsonPath('data.area_scope', 'Dhanmondi')->json('data.id');

        $this->withToken($admin->api_token)->postJson('/api/admin/users', [
            'name' => 'Invalid Area Admin',
            'phone' => '01912345679',
            'password' => 'secretpass',
            'role' => 'area_admin',
            'area_scope' => 'Unknown',
            'status' => 'active',
        ])->assertUnprocessable()->assertJsonValidationErrors('area_scope');

        $areaAdmin = User::findOrFail($areaAdminId);
        $areaToken = $this->postJson('/api/auth/login', [
            'phone' => $areaAdmin->phone, 'password' => 'secretpass',
        ])->assertOk()->json('token');
        $this->withToken($areaToken)->getJson('/api/area/overview')
            ->assertOk()
            ->assertJsonPath('data.area', 'Dhanmondi')
            ->assertJsonPath('data.centres.0.slug', 'own-centre')
            ->assertJsonPath('data.centres.0.bookings_count', 1)
            ->assertJsonPath('data.bookings.data.0.booking_no', 'OWN-1')
            ->assertDontSee('OTHER-1')
            ->assertDontSee('Other Customer')
            ->assertDontSee('other-centre');
        $this->withToken($areaToken)->getJson('/api/admin/bookings')->assertForbidden();
        $this->withToken($areaToken)->getJson('/api/bookings/OWN-1')->assertOk();
        $this->withToken($areaToken)->getJson('/api/bookings/OTHER-1')->assertForbidden();
        $this->withToken('')->getJson('/api/bookings/OWN-1')->assertUnauthorized();
        $this->withToken($admin->api_token)->getJson('/api/area/overview')->assertForbidden();
    }

    public function test_another_customer_cannot_cancel_someone_elses_booking(): void
    {
        $centre = $this->centre('Dhanmondi', 'cancel-centre');
        $owner = User::factory()->create(['role' => 'customer', 'phone' => '01911111111', 'api_token' => Str::random(72)]);
        $other = User::factory()->create(['role' => 'customer', 'phone' => '01922222222', 'api_token' => Str::random(72)]);
        Booking::create([
            'booking_no' => 'PRIVATE-1', 'user_id' => $owner->id,
            'centre_id' => $centre->id, 'customer_name' => $owner->name,
            'customer_phone' => $owner->phone,
            'event_date' => now()->addDays(10)->toDateString(),
            'session_type' => 'full_day', 'status' => 'payment_pending',
        ]);

        $this->withToken($other->api_token)->getJson('/api/bookings/PRIVATE-1')->assertForbidden();
        $this->withToken($other->api_token)->postJson('/api/bookings/PRIVATE-1/cancel')->assertForbidden();
        $this->assertDatabaseHas('bookings', ['booking_no' => 'PRIVATE-1', 'status' => 'payment_pending']);
    }

    public function test_suspended_account_cannot_log_in_or_use_existing_token(): void
    {
        $user = User::factory()->create([
            'role' => 'area_admin', 'area_scope' => 'Dhanmondi',
            'phone' => '01933333333', 'password' => 'secretpass',
            'status' => 'suspended', 'api_token' => Str::random(72),
        ]);

        $this->postJson('/api/auth/login', [
            'phone' => $user->phone, 'password' => 'secretpass',
        ])->assertForbidden();
        $this->withToken($user->api_token)->getJson('/api/area/overview')->assertForbidden();
    }

    private function centre(string $area, string $slug): CommunityCentre
    {
        return CommunityCentre::create([
            'name' => $slug, 'slug' => $slug, 'area' => $area,
            'capacity' => 100, 'base_price' => 1000, 'half_day_price' => 1000,
            'full_day_price' => 2000, 'status' => 'active',
        ]);
    }

    private function booking(CommunityCentre $centre, string $bookingNo, string $customer): void
    {
        Booking::create([
            'booking_no' => $bookingNo, 'centre_id' => $centre->id,
            'customer_name' => $customer, 'customer_phone' => '01900000000',
            'event_date' => now()->addDays(10)->toDateString(),
            'session_type' => 'full_day', 'status' => 'confirmed',
        ]);
    }
}
