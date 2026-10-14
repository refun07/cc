<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CaretakerAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_multiple_centres_permissions_reports_and_waste_stay_scoped(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $centres = collect(range(1, 3))->map(fn ($i) => CommunityCentre::create(['name' => "Centre $i", 'slug' => "centre-$i", 'area' => 'QA', 'working_area' => 'zone-1', 'status' => 'active']));
        $data = ['name' => 'Caretaker', 'phone' => '01888777666', 'password' => 'testpass123', 'role' => 'caretaker', 'status' => 'active', 'centre_ids' => [$centres[0]->id, $centres[1]->id], 'coordinator_permissions' => ['centres.view', 'bookings.view', 'bookings.note']];
        $id = $this->withToken($admin->api_token)->postJson('/api/admin/users', $data)->assertCreated()->assertJsonCount(2, 'data.centre_ids')->json('data.id');
        $caretaker = User::findOrFail($id);
        $caretaker->update(['api_token' => Str::random(72)]);
        foreach ($centres as $i => $centre) Booking::create(['booking_no' => "CARE-$i", 'centre_id' => $centre->id, 'customer_name' => 'Test', 'customer_phone' => '01888777555', 'event_date' => now()->subDay()->toDateString(), 'session_type' => 'full_day', 'status' => 'confirmed']);
        $this->withToken($caretaker->api_token)->getJson('/api/coordinator/overview')->assertOk()->assertJsonCount(2, 'data.centres')->assertJsonCount(2, 'data.bookings.data');
        $this->withToken($caretaker->api_token)->patchJson('/api/coordinator/bookings/CARE-1/note', ['notes' => 'Allowed'])->assertOk();
        $this->withToken($caretaker->api_token)->patchJson('/api/coordinator/bookings/CARE-2/note', ['notes' => 'Denied'])->assertForbidden();
        $this->withToken($caretaker->api_token)->postJson('/api/coordinator/bookings', [])->assertForbidden();
        $this->withToken($caretaker->api_token)->postJson('/api/caretaker/bookings/CARE-1/report', ['outcome' => 'completed'])->assertCreated();
        $this->withToken($caretaker->api_token)->postJson('/api/caretaker/bookings/CARE-2/report', ['outcome' => 'completed'])->assertForbidden();
        $this->withToken($caretaker->api_token)->getJson('/api/service-tickets/options')->assertOk()->assertJsonCount(2, 'data.centres');
        $waste = ['waste_type' => 'Paper', 'quantity' => 2, 'unit' => 'kg'];
        $this->withToken($caretaker->api_token)->postJson('/api/waste-requests', $waste)->assertUnprocessable();
        $this->withToken($caretaker->api_token)->postJson('/api/waste-requests', $waste + ['centre_id' => $centres[1]->id])->assertCreated();
        $this->withToken($caretaker->api_token)->postJson('/api/waste-requests', $waste + ['centre_id' => $centres[2]->id])->assertUnprocessable();
        $this->withToken($admin->api_token)->patchJson("/api/admin/users/$id/caretaker", [...$data, 'centre_ids' => [$centres[0]->id], 'coordinator_permissions' => []])->assertOk();
        $this->withToken($caretaker->api_token)->patchJson('/api/coordinator/bookings/CARE-0/note', ['notes' => 'Denied'])->assertForbidden();
        $this->withToken($caretaker->api_token)->getJson('/api/coordinator/overview')->assertOk()->assertJsonPath('data.bookings', null)->assertJsonCount(0, 'data.centres');
        $this->withToken($caretaker->api_token)->getJson('/api/waste-requests')->assertOk()->assertJsonCount(0, 'data.requests.data');
    }

    public function test_conversion_preserves_identity_assignments_permissions_and_credentials(): void
    {
        $user = User::factory()->create(['role' => 'project_coordinator', 'coordinator_permissions' => ['bookings.view', 'bookings.create'], 'api_token' => Str::random(72)]);
        $centre = CommunityCentre::create(['name' => 'Retained', 'slug' => 'retained', 'area' => 'QA']);
        $user->coordinatorCentres()->attach($centre->id);
        $password = $user->getRawOriginal('password');
        $token = $user->api_token;
        $migration = require database_path('migrations/2026_10_12_000008_consolidate_coordinators_as_caretakers.php');
        $migration->up();
        $migration->up();
        $user->refresh();
        $this->assertSame('caretaker', $user->role);
        $this->assertSame($password, $user->getRawOriginal('password'));
        $this->assertSame($token, $user->api_token);
        $this->assertSame(['bookings.view', 'bookings.create'], $user->coordinator_permissions);
        $this->assertSame([$centre->id], $user->assignedCentreIds()->all());
        $this->assertDatabaseCount('coordinator_centre', 1);
        $this->withToken($token)->getJson('/api/caretaker/overview')->assertOk();
        $this->withToken($token)->getJson('/api/coordinator/overview')->assertOk();
    }
}
