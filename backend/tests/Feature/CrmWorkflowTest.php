<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\CrmContact;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CrmWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private CommunityCentre $centre;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $this->centre = CommunityCentre::create([
            'owner_id' => $this->owner->id, 'name' => 'CRM Centre', 'slug' => 'crm-centre',
            'area' => 'Wari', 'capacity' => 300, 'base_price' => 30000,
            'half_day_price' => 30000, 'full_day_price' => 50000, 'status' => 'active',
        ]);
    }

    public function test_owner_can_manage_pipeline_and_log_follow_up_activity(): void
    {
        $contactId = $this->withToken($this->owner->api_token)->postJson('/api/owner/crm', [
            'name' => 'Corporate Lead',
            'phone' => '01755555555',
            'email' => 'lead@example.com',
            'stage' => 'new',
            'source' => 'Facebook',
            'tags' => ['corporate', 'priority'],
        ])->assertCreated()->json('data.id');

        $followUp = now()->addDay()->seconds(0);
        $this->withToken($this->owner->api_token)->postJson("/api/owner/crm/{$contactId}/activities", [
            'type' => 'call',
            'subject' => 'Discussed annual conference',
            'details' => 'Send package proposal before noon.',
            'next_follow_up_at' => $followUp->toIso8601String(),
        ])->assertCreated()
            ->assertJsonPath('contact.stage', 'contacted');

        $this->withToken($this->owner->api_token)->getJson('/api/owner/crm')
            ->assertOk()
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('summary.active_pipeline', 1)
            ->assertJsonPath('data.0.activities_count', 1);

        $this->withToken($this->owner->api_token)->getJson("/api/owner/crm/{$contactId}")
            ->assertOk()
            ->assertJsonPath('data.activities.0.subject', 'Discussed annual conference');
    }

    public function test_owner_cannot_access_another_centres_contact(): void
    {
        $otherOwner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $otherCentre = CommunityCentre::create([
            'owner_id' => $otherOwner->id, 'name' => 'Other Centre', 'slug' => 'other-centre',
            'area' => 'Gulshan', 'capacity' => 200, 'base_price' => 20000,
            'half_day_price' => 20000, 'full_day_price' => 35000, 'status' => 'active',
        ]);
        $contact = CrmContact::create([
            'centre_id' => $otherCentre->id, 'name' => 'Private Contact',
            'phone' => '01999999999', 'stage' => 'new', 'source' => 'manual',
        ]);

        $this->withToken($this->owner->api_token)->getJson("/api/owner/crm/{$contact->id}")->assertForbidden();
        $this->withToken($this->owner->api_token)->patchJson("/api/owner/crm/{$contact->id}", ['name' => 'Changed', 'phone' => '01999999999'])->assertForbidden();
    }
}
