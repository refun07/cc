<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use App\Models\WasteStream;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class WasteRequestWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, array $attributes = []): User
    {
        return User::factory()->create($attributes + ['role' => $role, 'status' => 'active', 'api_token' => Str::random(72)]);
    }

    public function test_caretaker_requests_area_assigns_and_only_local_caretaker_confirms_collection(): void
    {
        $owner = $this->user('owner');
        $centre = CommunityCentre::create(['name' => 'QA Centre', 'slug' => 'qa-centre', 'area' => 'Basabo', 'working_area' => 'zone-1', 'owner_id' => $owner->id]);
        $caretaker = $this->user('caretaker', ['caretaker_centre_id' => $centre->id]);
        $area = $this->user('area_admin', ['area_scope' => 'zone-1']);
        $other = $this->user('area_admin', ['area_scope' => 'zone-2']);
        $city = $this->user('admin');
        $partner = $this->user('waste_partner');
        $id = $this->withToken($caretaker->api_token)->postJson('/api/waste-requests', [
            'waste_type' => 'Mixed waste', 'quantity' => 20, 'unit' => 'kg',
            'centre_id' => $centre->id, 'status' => 'collected', 'assigned_partner_id' => $partner->id,
        ])->assertCreated()->assertJsonPath('data.status', 'sorting_required')->assertJsonPath('data.centre_id', $centre->id)->json('data.id');
        $this->assertDatabaseHas('app_notifications', ['user_id' => $area->id, 'title' => 'Waste collection requested']);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $city->id, 'title' => 'Waste collection requested']);
        $this->withToken($other->api_token)->getJson('/api/waste-requests')->assertOk()->assertJsonPath('data.counts.requested', 0);
        $this->withToken($area->api_token)->getJson('/api/waste-requests')->assertOk()->assertJsonPath('data.counts.requested', 1);
        $this->withToken($caretaker->api_token)->postJson("/api/waste-requests/$id/complete", ['confirmed' => true])->assertUnprocessable();
        $assignment = ['partner_id' => $partner->id, 'pickup_scheduled_for' => now()->addHour()->toIso8601String()];
        $this->withToken($other->api_token)->postJson("/api/waste-requests/$id/assign", $assignment)->assertNotFound();
        $this->withToken($caretaker->api_token)->postJson("/api/waste-requests/$id/assign", $assignment)->assertForbidden();
        $this->withToken($area->api_token)->postJson("/api/waste-requests/$id/assign", ['partner_id' => $owner->id] + $assignment)->assertUnprocessable();
        $this->withToken($area->api_token)->postJson("/api/waste-requests/$id/assign", $assignment)->assertOk()->assertJsonPath('data.assigned_by', $area->id);
        $this->withToken($area->api_token)->postJson("/api/waste-requests/$id/assign", $assignment)->assertUnprocessable();
        $this->withToken($partner->api_token)->patchJson("/api/partner/pickups/$id/status", ['status' => 'collected'])->assertUnprocessable();
        $this->withToken($owner->api_token)->postJson("/api/owner/waste/$id/assign", $assignment)->assertForbidden();
        $this->withToken($owner->api_token)->deleteJson("/api/owner/waste/$id")->assertForbidden();
        $this->withToken($area->api_token)->postJson("/api/waste-requests/$id/complete", ['confirmed' => true])->assertForbidden();
        $elsewhere = CommunityCentre::create(['name' => 'Other', 'slug' => 'other', 'area' => 'Wari']);
        $otherCaretaker = $this->user('caretaker', ['caretaker_centre_id' => $elsewhere->id]);
        $this->withToken($otherCaretaker->api_token)->postJson("/api/waste-requests/$id/complete", ['confirmed' => true])->assertNotFound();
        $this->travel(2)->hours();
        $this->withToken($caretaker->api_token)->postJson("/api/waste-requests/$id/complete", ['confirmed' => false])->assertUnprocessable();
        $this->withToken($caretaker->api_token)->postJson("/api/waste-requests/$id/complete", ['confirmed' => true, 'notes' => 'Collected from centre'])
            ->assertOk()->assertJsonPath('data.status', 'collected')->assertJsonPath('data.collection_confirmed_by', $caretaker->id);
        $timestamp = WasteStream::find($id)->collected_at;
        $this->withToken($caretaker->api_token)->postJson("/api/waste-requests/$id/complete", ['confirmed' => true])->assertUnprocessable();
        $this->assertEquals($timestamp, WasteStream::find($id)->collected_at);
        $this->withToken($area->api_token)->getJson('/api/waste-requests?scope=completed')->assertOk()->assertJsonPath('data.counts.completed', 1)->assertJsonPath('data.requests.data.0.collection_confirmer.id', $caretaker->id);
        $this->withToken($city->api_token)->getJson('/api/waste-requests?scope=completed')->assertOk()->assertJsonPath('data.counts.completed', 1);
        $this->withToken($area->api_token)->getJson('/api/waste-delays')->assertOk()->assertJsonPath('data.overdue_count', 0)->assertJsonPath('data.collected_late_count', 1);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $area->id, 'title' => 'Waste collection confirmed']);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $city->id, 'title' => 'Waste collection confirmed']);
        $this->withToken($partner->api_token)->patchJson("/api/partner/pickups/$id/status", ['status' => 'recycled'])->assertOk();
    }

    public function test_unassigned_and_unprivileged_users_cannot_access_workflow(): void
    {
        $this->getJson('/api/waste-requests')->assertUnauthorized();
        foreach (['customer', 'owner', 'waste_partner', 'caretaker', 'area_admin'] as $role) {
            $user = $this->user($role);
            $this->withToken($user->api_token)->getJson('/api/waste-requests')->assertForbidden();
            $this->withToken($user->api_token)->postJson('/api/waste-requests', ['waste_type' => 'Waste', 'quantity' => 2, 'unit' => 'kg'])->assertForbidden();
        }
        $this->assertDatabaseCount('waste_streams', 0);
    }
}
