<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CaretakerWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_caretaker_reports_real_completion_and_area_and_city_admins_see_it(): void
    {
        $centre = $this->centre('Basabo', 'zone-1');
        $other = $this->centre('Wari', 'zone-2');
        $owner = $this->user('owner');
        $centre->update(['owner_id' => $owner->id]);
        $caretaker = $this->user('caretaker', ['caretaker_centre_id' => $centre->id]);
        $area = $this->user('area_admin', ['area_scope' => 'zone-1']);
        $otherArea = $this->user('area_admin', ['area_scope' => 'zone-2']);
        $city = $this->user('admin');
        $booking = $this->booking($centre, 'CARE-1', now('Asia/Dhaka')->subDay()->toDateString());
        $otherBooking = $this->booking($other, 'OTHER-1', now('Asia/Dhaka')->subDay()->toDateString());
        $future = $this->booking($centre, 'FUTURE-1', now('Asia/Dhaka')->addDay()->toDateString());

        $this->withToken($caretaker->api_token)->getJson('/api/caretaker/overview')
            ->assertOk()->assertJsonPath('data.centre.area', 'Basabo')
            ->assertJsonPath('data.centre.working_area', 'zone-1')
            ->assertJsonCount(1, 'data.pending_reports');
        $this->withToken($owner->api_token)->patchJson('/api/owner/bookings/CARE-1/status', ['action' => 'complete'])
            ->assertUnprocessable();
        $this->withToken($caretaker->api_token)->postJson('/api/caretaker/bookings/OTHER-1/report', [
            'outcome' => 'completed',
        ])->assertForbidden();
        $this->withToken($caretaker->api_token)->postJson('/api/caretaker/bookings/FUTURE-1/report', [
            'outcome' => 'completed',
        ])->assertUnprocessable();
        $this->withToken($caretaker->api_token)->postJson('/api/caretaker/bookings/CARE-1/report', [
            'outcome' => 'completed', 'notes' => 'Event finished at 10 pm.',
        ])->assertCreated()->assertJsonPath('data.outcome', 'completed');
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'completed']);
        $this->assertDatabaseHas('booking_completion_reports', [
            'booking_id' => $booking->id, 'caretaker_id' => $caretaker->id,
        ]);
        $this->withToken($caretaker->api_token)->postJson('/api/caretaker/bookings/CARE-1/report', [
            'outcome' => 'completed',
        ])->assertUnprocessable();
        $this->withToken($area->api_token)->getJson('/api/event-reports')
            ->assertOk()->assertJsonPath('data.rows.0.report.outcome', 'completed')
            ->assertDontSee('OTHER-1');
        $this->withToken($otherArea->api_token)->getJson('/api/event-reports')
            ->assertJsonCount(0, 'data.rows')
            ->assertDontSee('CARE-1');
        $this->withToken($city->api_token)->getJson('/api/event-reports')
            ->assertJsonCount(1, 'data.rows')
            ->assertDontSee($otherBooking->booking_no);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $area->id, 'title' => 'Caretaker event report']);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $city->id, 'title' => 'Caretaker event report']);
    }

    public function test_caretaker_issue_is_routed_to_area_admin_and_city_admin_tracks_it(): void
    {
        $centre = $this->centre('Basabo', 'zone-1');
        $caretaker = $this->user('caretaker', ['caretaker_centre_id' => $centre->id]);
        $area = $this->user('area_admin', ['area_scope' => 'zone-1']);
        $city = $this->user('admin');
        $this->withToken($caretaker->api_token)->getJson('/api/service-tickets/options')
            ->assertJsonCount(1, 'data.centres');
        $id = $this->withToken($caretaker->api_token)->postJson('/api/service-tickets', [
            'centre_id' => $centre->id, 'subject' => 'Fan repair',
            'description' => 'Ceiling fan in the main hall is not working.',
        ])->assertCreated()->assertJsonPath('data.assigned_to', $area->id)->json('data.id');
        $this->withToken($area->api_token)->getJson('/api/service-tickets')
            ->assertOk()->assertJsonPath('data.data.0.id', $id);
        $this->withToken($city->api_token)->getJson('/api/service-tickets')
            ->assertOk()->assertJsonPath('data.data.0.id', $id);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $city->id, 'title' => 'New service ticket']);

        $area->update(['status' => 'suspended']);
        $secondId = $this->withToken($caretaker->api_token)->postJson('/api/service-tickets', [
            'centre_id' => $centre->id, 'subject' => 'Light repair',
            'description' => 'Stage light needs replacement.',
        ])->assertCreated()->assertJsonPath('data.assigned_to', $city->id)->json('data.id');
        $this->assertDatabaseHas('service_tickets', ['id' => $secondId, 'assigned_to' => $city->id]);
    }

    public function test_admin_assigns_caretaker_and_negative_report_does_not_complete_booking(): void
    {
        $centre = $this->centre('Basabo', 'zone-1');
        $admin = $this->user('admin');
        $id = $this->withToken($admin->api_token)->postJson('/api/admin/users', [
            'name' => 'Caretaker One', 'phone' => '01712345678', 'password' => 'secretpass',
            'role' => 'caretaker', 'caretaker_centre_id' => $centre->id, 'status' => 'active',
            'centre_ids' => [], 'coordinator_permissions' => ['centres.view', 'bookings.view'],
        ])->assertCreated()->assertJsonPath('data.caretaker_centre_id', $centre->id)->json('data.id');
        $caretaker = User::findOrFail($id);
        $token = $this->postJson('/api/auth/login', [
            'phone' => $caretaker->phone, 'password' => 'secretpass',
        ])->assertOk()->json('token');
        $booking = $this->booking($centre, 'CARE-2', now('Asia/Dhaka')->toDateString());
        $unapproved = $this->booking($centre, 'UNAPPROVED-1', now('Asia/Dhaka')->toDateString());
        $unapproved->update(['status' => 'pending_review']);
        $this->withToken($token)->postJson('/api/caretaker/bookings/UNAPPROVED-1/report', [
            'outcome' => 'completed',
        ])->assertUnprocessable();
        $this->assertDatabaseHas('bookings', ['id' => $unapproved->id, 'status' => 'pending_review']);
        $this->withToken($token)->getJson('/api/caretaker/overview')
            ->assertOk()->assertJsonCount(1, 'data.pending_reports');
        $this->withToken($token)->postJson('/api/caretaker/bookings/CARE-2/report', [
            'outcome' => 'not_completed',
        ])->assertUnprocessable();
        $this->withToken($token)->postJson('/api/caretaker/bookings/CARE-2/report', [
            'outcome' => 'not_completed', 'notes' => 'Event was postponed.',
        ])->assertCreated();
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'confirmed']);
    }

    private function user(string $role, array $attributes = []): User
    {
        return User::factory()->create($attributes + [
            'role' => $role, 'status' => 'active', 'api_token' => Str::random(72),
        ]);
    }

    private function centre(string $area, string $workingArea): CommunityCentre
    {
        return CommunityCentre::create([
            'name' => $area.' Centre', 'slug' => Str::slug($area).'-centre',
            'area' => $area, 'working_area' => $workingArea, 'capacity' => 100,
            'base_price' => 1000, 'half_day_price' => 1000, 'full_day_price' => 2000,
            'status' => 'active',
        ]);
    }

    private function booking(CommunityCentre $centre, string $number, string $date): Booking
    {
        return Booking::create([
            'booking_no' => $number, 'centre_id' => $centre->id,
            'customer_name' => 'Customer', 'customer_phone' => '01700000000',
            'event_date' => $date, 'session_type' => 'full_day', 'status' => 'confirmed',
        ]);
    }
}
