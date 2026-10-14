<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ServiceTicketTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_creates_ticket_assignee_acts_and_admin_sees_timestamps(): void
    {
        $owner = $this->user('owner');
        $area = $this->user('area_admin', ['area_scope' => 'zone-1']);
        $coordinator = $this->user('project_coordinator');
        $partner = $this->user('waste_partner');
        $admin = $this->user('admin');
        $centre = $this->centre($owner, 'Wari');
        $centre->update(['working_area' => 'zone-1']);
        $coordinator->coordinatorCentres()->sync([$centre->id]);

        $this->withToken($owner->api_token)->getJson('/api/service-tickets/options')->assertOk()
            ->assertJsonPath('data.centres.0.id', $centre->id)
            ->assertJsonCount(3, "data.recipients.{$centre->id}");
        $ticketId = $this->withToken($owner->api_token)->postJson('/api/service-tickets', [
            'centre_id' => $centre->id, 'assigned_to' => $coordinator->id,
            'subject' => 'Lighting repair', 'description' => 'The main hall lights need repair.',
        ])->assertCreated()->assertJsonPath('data.status', 'open')
            ->assertJsonCount(1, 'data.actions')->json('data.id');

        $this->withToken($area->api_token)->getJson("/api/service-tickets/{$ticketId}")->assertOk();
        $this->withToken($partner->api_token)->getJson('/api/service-tickets')->assertOk()
            ->assertJsonCount(0, 'data.data');
        $this->withToken($coordinator->api_token)->postJson("/api/service-tickets/{$ticketId}/actions", [
            'action' => 'resolve', 'message' => 'Done',
        ])->assertForbidden();
        $this->withToken($coordinator->api_token)->postJson("/api/service-tickets/{$ticketId}/actions", [
            'action' => 'acknowledge',
        ])->assertOk()->assertJsonPath('data.status', 'in_progress');
        $this->withToken($coordinator->api_token)->postJson("/api/service-tickets/{$ticketId}/actions", [
            'action' => 'resolve', 'message' => 'Lights replaced and tested.',
        ])->assertOk()->assertJsonPath('data.status', 'resolved');
        $this->withToken($owner->api_token)->postJson("/api/service-tickets/{$ticketId}/actions", [
            'action' => 'close',
        ])->assertOk()->assertJsonPath('data.status', 'closed');

        $this->withToken($admin->api_token)->getJson("/api/service-tickets/{$ticketId}")
            ->assertOk()->assertJsonCount(4, 'data.actions')
            ->assertJsonPath('data.actions.2.message', 'Lights replaced and tested.')
            ->assertJsonPath('data.assignee.id', $coordinator->id);
        $this->assertDatabaseHas('service_tickets', ['id' => $ticketId, 'status' => 'closed']);
        $this->assertDatabaseCount('service_ticket_actions', 4);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $admin->id, 'title' => 'New service ticket']);
        $this->assertNotNull(\App\Models\ServiceTicket::findOrFail($ticketId)->first_responded_at);
        $this->assertNotNull(\App\Models\ServiceTicket::findOrFail($ticketId)->resolved_at);
    }

    public function test_centre_and_recipient_scope_cannot_be_bypassed(): void
    {
        $owner = $this->user('owner');
        $otherOwner = $this->user('owner');
        $customer = $this->user('customer');
        $area = $this->user('area_admin', ['area_scope' => 'Wari']);
        $centre = $this->centre($owner, 'Wari');
        $other = $this->centre($otherOwner, 'Motijheel');
        $payload = [
            'centre_id' => $centre->id, 'assigned_to' => $area->id,
            'subject' => 'Water supply', 'description' => 'Water pressure is too low.',
        ];
        $this->withToken($customer->api_token)->postJson('/api/service-tickets', $payload)->assertForbidden();
        $this->withToken($otherOwner->api_token)->postJson('/api/service-tickets', $payload)->assertForbidden();
        $this->withToken($owner->api_token)->postJson('/api/service-tickets', [
            ...$payload, 'centre_id' => $other->id,
        ])->assertForbidden();
        $wrongArea = $this->user('area_admin', ['area_scope' => 'Motijheel']);
        $this->withToken($owner->api_token)->postJson('/api/service-tickets', [
            ...$payload, 'assigned_to' => $wrongArea->id,
        ])->assertUnprocessable();
        $ticketId = $this->withToken($owner->api_token)->postJson('/api/service-tickets', $payload)
            ->assertCreated()->json('data.id');
        $this->withToken($wrongArea->api_token)->getJson("/api/service-tickets/{$ticketId}")->assertForbidden();
        $this->withToken($otherOwner->api_token)->getJson("/api/service-tickets/{$ticketId}")->assertForbidden();
        $this->withToken($otherOwner->api_token)->postJson("/api/service-tickets/{$ticketId}/actions", [
            'action' => 'comment', 'message' => 'Not authorized',
        ])->assertForbidden();
        $this->withToken($owner->api_token)->postJson("/api/service-tickets/{$ticketId}/actions", [
            'action' => 'close',
        ])->assertForbidden();
    }

    private function user(string $role, array $extra = []): User
    {
        return User::factory()->create($extra + [
            'role' => $role, 'status' => 'active', 'api_token' => Str::random(72),
        ]);
    }

    private function centre(User $owner, string $area): CommunityCentre
    {
        return CommunityCentre::create([
            'owner_id' => $owner->id, 'name' => $area.' Centre', 'slug' => Str::slug($area).'-centre',
            'area' => $area, 'capacity' => 100, 'base_price' => 1000,
            'half_day_price' => 1000, 'full_day_price' => 2000, 'status' => 'active',
        ]);
    }
}
