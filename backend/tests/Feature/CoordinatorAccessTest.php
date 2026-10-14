<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CoordinatorAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_assigns_multiple_centres_and_permissions_are_enforced(): void
    {
        $first = $this->centre('First', 'Dhanmondi');
        $second = $this->centre('Second', 'Wari');
        $outside = $this->centre('Outside', 'Wari');
        $this->booking($first, 'FIRST-1');
        $this->booking($second, 'SECOND-1');
        $this->booking($outside, 'OUTSIDE-1');
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);

        $payload = [
            'name' => 'Project Coordinator', 'phone' => '01912345678',
            'password' => 'secretpass', 'role' => 'project_coordinator',
            'status' => 'active', 'centre_ids' => [$first->id, $second->id],
            'coordinator_permissions' => ['centres.view', 'bookings.view', 'bookings.create', 'bookings.note'],
        ];
        $id = $this->withToken($admin->api_token)->postJson('/api/admin/users', $payload)
            ->assertCreated()->assertJsonPath('data.centre_ids.0', $first->id)->json('data.id');

        $this->withToken($admin->api_token)->postJson('/api/admin/users', [
            ...$payload, 'phone' => '01912345679', 'centre_ids' => [$first->id, 999999],
        ])->assertUnprocessable()->assertJsonValidationErrors('centre_ids.1');
        $this->withToken($admin->api_token)->postJson('/api/admin/users', [
            ...$payload, 'phone' => '01912345679', 'coordinator_permissions' => ['users.manage'],
        ])->assertUnprocessable()->assertJsonValidationErrors('coordinator_permissions.0');

        $token = $this->postJson('/api/auth/login', ['phone' => $payload['phone'], 'password' => 'secretpass'])
            ->assertOk()->json('token');
        $this->withToken($token)->getJson('/api/coordinator/overview')
            ->assertOk()->assertJsonCount(2, 'data.centres')
            ->assertJsonCount(2, 'data.bookings.data')
            ->assertDontSee('OUTSIDE-1');
        $this->withToken($token)->getJson('/api/bookings/FIRST-1')->assertOk();
        $this->withToken($token)->getJson('/api/bookings/OUTSIDE-1')->assertForbidden();
        $this->withToken($token)->getJson('/api/admin/users')->assertForbidden();
        $this->withToken($token)->getJson('/api/owner/bookings')->assertForbidden();

        $date = now()->addDays(12)->toDateString();
        $create = [
            'centre_slug' => $outside->slug, 'customer_name' => 'Test Customer',
            'customer_phone' => '01911111111', 'event_date' => $date,
            'session_type' => 'half_day_morning', 'guest_count' => 20,
            'mark_paid' => true, 'payment_method' => 'Cash',
        ];
        $this->withToken($token)->postJson('/api/coordinator/bookings', $create)->assertForbidden();
        $bookingNo = $this->withToken($token)->postJson('/api/coordinator/bookings', [
            ...$create, 'centre_slug' => $first->slug,
        ])->assertCreated()->json('data.booking_no');
        $this->assertDatabaseHas('bookings', [
            'booking_no' => $bookingNo, 'centre_id' => $first->id,
            'paid_amount' => 0, 'status' => 'payment_pending',
        ]);

        $this->withToken($token)->patchJson('/api/coordinator/bookings/FIRST-1/note', ['notes' => 'Confirmed by phone'])
            ->assertOk();
        $this->withToken($token)->patchJson('/api/coordinator/bookings/OUTSIDE-1/note', ['notes' => 'Should fail'])
            ->assertForbidden();

        $this->withToken($admin->api_token)->patchJson("/api/admin/users/{$id}/coordinator", [
            'name' => 'Project Coordinator', 'phone' => '01912345678',
            'centre_ids' => [$second->id], 'coordinator_permissions' => ['centres.view'],
        ])->assertOk()->assertJsonPath('data.centre_ids.0', $second->id);
        $this->withToken($token)->getJson('/api/coordinator/overview')
            ->assertOk()->assertJsonCount(1, 'data.centres')->assertJsonPath('data.bookings', null);
        $this->withToken($token)->getJson('/api/bookings/FIRST-1')->assertForbidden();
        $this->withToken($token)->postJson('/api/coordinator/bookings', [
            ...$create, 'centre_slug' => $second->slug,
        ])->assertForbidden();
        $this->withToken($token)->patchJson('/api/coordinator/bookings/SECOND-1/note', ['notes' => 'Should fail'])
            ->assertForbidden();

        $this->withToken($admin->api_token)->patchJson("/api/admin/users/{$id}/coordinator", [
            'name' => 'Project Coordinator', 'phone' => '01912345678',
            'centre_ids' => [$second->id], 'coordinator_permissions' => [],
        ])->assertOk()->assertJsonPath('data.coordinator_permissions', []);
        $this->withToken($token)->getJson('/api/coordinator/overview')
            ->assertOk()->assertJsonCount(0, 'data.centres');
    }

    public function test_owner_completes_then_coordinator_verifies_only_eligible_assigned_events(): void
    {
        $this->travelTo(Carbon::parse('2026-10-10 20:30:00', 'UTC'));
        $today = now('Asia/Dhaka')->toDateString();
        $tomorrow = now('Asia/Dhaka')->addDay()->toDateString();
        $assigned = $this->centre('Assigned', 'Wari');
        $outside = $this->centre('Unassigned', 'Wari');
        $owner = User::factory()->create([
            'role' => 'owner', 'status' => 'active', 'api_token' => Str::random(72),
        ]);
        $assigned->update(['owner_id' => $owner->id]);
        $coordinator = User::factory()->create([
            'role' => 'project_coordinator', 'status' => 'active', 'api_token' => Str::random(72),
            'coordinator_permissions' => ['bookings.view', 'bookings.verify'],
        ]);
        $coordinator->coordinatorCentres()->sync([$assigned->id]);

        foreach ([
            ['TODAY-1', $assigned, $today, 'confirmed'],
            ['FUTURE-1', $assigned, $tomorrow, 'confirmed'],
            ['PENDING-1', $assigned, $today, 'payment_pending'],
            ['DUE-1', $assigned, $today, 'confirmed'],
            ['OUTSIDE-1', $outside, $today, 'confirmed'],
            ['MULTI-1', $assigned, $today, 'confirmed'],
        ] as [$number, $centre, $date, $status]) {
            $booking = Booking::create([
                'booking_no' => $number, 'centre_id' => $centre->id,
                'customer_name' => 'Customer', 'customer_phone' => '01900000000',
                'event_date' => $date, 'session_type' => 'full_day', 'status' => $status,
            ]);
            if ($number === 'MULTI-1') {
                $booking->bookingDates()->createMany([
                    ['date' => $today, 'session_type' => 'full_day'],
                    ['date' => $tomorrow, 'session_type' => 'full_day'],
                ]);
            }
            if ($number === 'DUE-1') {
                $booking->update(['due_amount' => 500]);
            }
        }

        $this->withToken($coordinator->api_token)->getJson('/api/coordinator/overview')
            ->assertOk()->assertJsonPath('data.today', $today)
            ->assertJsonCount(4, 'data.today_bookings')
            ->assertDontSee('OUTSIDE-1');
        $todayRows = collect($this->withToken($coordinator->api_token)
            ->getJson('/api/coordinator/overview')->json('data.today_bookings'))->keyBy('booking_no');
        $this->assertFalse($todayRows['TODAY-1']['can_verify']);
        $this->withToken($coordinator->api_token)->patchJson('/api/coordinator/bookings/TODAY-1/verify-completion')->assertUnprocessable();
        $this->withToken($owner->api_token)->patchJson('/api/owner/bookings/FUTURE-1/status', ['action' => 'complete'])->assertUnprocessable();
        $this->withToken($owner->api_token)->patchJson('/api/owner/bookings/MULTI-1/status', ['action' => 'complete'])->assertUnprocessable();
        $this->withToken($owner->api_token)->patchJson('/api/owner/bookings/PENDING-1/status', ['action' => 'complete'])->assertUnprocessable();
        $this->withToken($owner->api_token)->patchJson('/api/owner/bookings/DUE-1/status', ['action' => 'complete'])->assertUnprocessable();

        $this->withToken($owner->api_token)->patchJson('/api/owner/bookings/TODAY-1/status', ['action' => 'complete'])
            ->assertOk()->assertJsonPath('data.status', 'completed');
        $this->assertDatabaseHas('bookings', ['booking_no' => 'TODAY-1', 'completion_verified_by' => null]);
        $todayRows = collect($this->withToken($coordinator->api_token)
            ->getJson('/api/coordinator/overview')->json('data.today_bookings'))->keyBy('booking_no');
        $this->assertTrue($todayRows['TODAY-1']['can_verify']);
        $this->assertFalse($todayRows['PENDING-1']['can_verify']);
        $this->assertFalse($todayRows['DUE-1']['can_verify']);
        $this->assertFalse($todayRows['MULTI-1']['can_verify']);
        $this->withToken($coordinator->api_token)->patchJson('/api/coordinator/bookings/OUTSIDE-1/verify-completion')->assertForbidden();
        $this->withToken($coordinator->api_token)->patchJson('/api/coordinator/bookings/FUTURE-1/verify-completion')->assertUnprocessable();

        $this->withToken($coordinator->api_token)->patchJson('/api/coordinator/bookings/TODAY-1/verify-completion')
            ->assertOk()->assertJsonPath('status', 'completed');
        $this->assertDatabaseHas('bookings', [
            'booking_no' => 'TODAY-1', 'status' => 'completed',
            'completion_verified_by' => $coordinator->id,
        ]);
        $this->assertNotNull(Booking::where('booking_no', 'TODAY-1')->first()->completion_verified_at);
        $this->withToken($coordinator->api_token)->patchJson('/api/coordinator/bookings/TODAY-1/verify-completion')->assertUnprocessable();

        $coordinator->update(['coordinator_permissions' => ['bookings.view']]);
        $this->withToken($coordinator->api_token)->patchJson('/api/coordinator/bookings/TODAY-1/verify-completion')->assertForbidden();
    }

    private function centre(string $name, string $area): CommunityCentre
    {
        return CommunityCentre::create([
            'name' => $name, 'slug' => strtolower($name), 'area' => $area,
            'capacity' => 100, 'base_price' => 1000, 'half_day_price' => 1000,
            'full_day_price' => 2000, 'status' => 'active',
        ]);
    }

    private function booking(CommunityCentre $centre, string $bookingNo): void
    {
        Booking::create([
            'booking_no' => $bookingNo, 'centre_id' => $centre->id,
            'customer_name' => 'Customer', 'customer_phone' => '01900000000',
            'event_date' => now()->addDays(10)->toDateString(),
            'session_type' => 'full_day', 'status' => 'confirmed',
        ]);
    }
}
