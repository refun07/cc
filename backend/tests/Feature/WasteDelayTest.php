<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use App\Models\WasteStream;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use Tests\TestCase;

class WasteDelayTest extends TestCase
{
    use RefreshDatabase;

    public function test_overdue_pickups_are_scoped_and_alerted_once_then_kept_as_late_history(): void
    {
        $this->travelTo(Carbon::parse('2026-10-12 10:00:00', 'UTC'));
        $centre = $this->centre('Basabo', 'zone-1');
        $elsewhere = $this->centre('Wari', 'zone-2');
        $partner = $this->user('waste_partner');
        $area = $this->user('area_admin', ['area_scope' => 'zone-1']);
        $otherArea = $this->user('area_admin', ['area_scope' => 'zone-2']);
        $city = $this->user('admin');
        $customer = $this->user('customer');
        $late = $this->pickup($centre, $partner, now()->subHour());
        $otherLate = $this->pickup($elsewhere, $partner, now()->subHours(2));
        $this->pickup($centre, $partner, now()->addHour());
        $this->pickup($centre, $partner, null);

        $this->withToken($area->api_token)->getJson('/api/waste-delays')
            ->assertOk()->assertJsonPath('data.overdue_count', 1)
            ->assertJsonPath('data.pickups.data.0.id', $late->id)
            ->assertJsonPath('data.pickups.data.0.delay_minutes', 60)
            ->assertJsonCount(1, 'data.pickups.data');
        $this->withToken($otherArea->api_token)->getJson('/api/waste-delays')
            ->assertOk()->assertJsonPath('data.pickups.data.0.id', $otherLate->id);
        $this->withToken($city->api_token)->getJson('/api/waste-delays')
            ->assertOk()->assertJsonPath('data.overdue_count', 2);
        $this->withToken($customer->api_token)->getJson('/api/waste-delays')->assertForbidden();

        Artisan::call('waste:alert-delays');
        Artisan::call('waste:alert-delays');
        $this->assertDatabaseCount('app_notifications', 4);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $area->id, 'title' => 'Waste pickup overdue']);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $city->id, 'title' => 'Waste pickup overdue']);
        $this->assertDatabaseMissing('app_notifications', ['user_id' => $customer->id, 'title' => 'Waste pickup overdue']);

        $this->withToken($partner->api_token)->patchJson("/api/partner/pickups/{$late->id}/status", [
            'status' => 'collected',
        ])->assertOk();
        $this->withToken($area->api_token)->getJson('/api/waste-delays')
            ->assertJsonPath('data.overdue_count', 0)
            ->assertJsonPath('data.collected_late_count', 1);
        $this->withToken($area->api_token)->getJson('/api/waste-delays?scope=collected_late')
            ->assertJsonPath('data.pickups.data.0.id', $late->id)
            ->assertJsonPath('data.pickups.data.0.delay_status', 'collected_late');
    }

    public function test_rescheduling_resets_alert_and_pickup_time_is_required(): void
    {
        $centre = $this->centre('Basabo', 'zone-1');
        $owner = $this->user('owner');
        $centre->update(['owner_id' => $owner->id]);
        $partner = $this->user('waste_partner');
        $pickup = $this->pickup($centre, $partner, now()->subHour());
        $pickup->update(['pickup_delay_alerted_at' => now()]);

        $this->withToken($owner->api_token)->postJson("/api/owner/waste/{$pickup->id}/assign", [
            'partner_id' => $partner->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('pickup_scheduled_for');
        $this->withToken($owner->api_token)->postJson("/api/owner/waste/{$pickup->id}/assign", [
            'partner_id' => $partner->id,
            'pickup_scheduled_for' => now()->addHour()->toIso8601String(),
        ])->assertOk();
        $this->assertNull($pickup->fresh()->pickup_delay_alerted_at);
    }

    private function user(string $role, array $attributes = []): User
    {
        return User::factory()->create($attributes + [
            'role' => $role, 'status' => 'active', 'api_token' => Str::random(72),
        ]);
    }

    private function centre(string $name, string $workingArea): CommunityCentre
    {
        return CommunityCentre::create([
            'name' => $name, 'slug' => Str::slug($name).'-centre', 'area' => $name,
            'working_area' => $workingArea, 'status' => 'active',
        ]);
    }

    private function pickup(CommunityCentre $centre, User $partner, ?Carbon $scheduled): WasteStream
    {
        return WasteStream::create([
            'centre_id' => $centre->id, 'assigned_partner_id' => $partner->id,
            'waste_type' => 'Mixed waste', 'quantity' => 12, 'unit' => 'kg',
            'status' => 'pickup_assigned', 'pickup_scheduled_for' => $scheduled,
        ]);
    }
}
