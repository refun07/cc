<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\User;
use App\Services\BookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SettlementWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $owner;
    private CommunityCentre $centre;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'api_token' => Str::random(72),
        ]);
        $this->owner = User::factory()->create([
            'role' => 'owner',
            'api_token' => Str::random(72),
        ]);
        $this->centre = CommunityCentre::create([
            'owner_id' => $this->owner->id,
            'name' => 'Settlement Test Centre',
            'slug' => 'settlement-test-centre',
            'area' => 'Dhanmondi',
            'capacity' => 500,
            'base_price' => 50000,
            'half_day_price' => 50000,
            'full_day_price' => 100000,
            'commission_rate' => 5,
            'status' => 'active',
        ]);
    }

    public function test_admin_generates_settlement_once_and_owner_can_see_it(): void
    {
        $this->createPaidBooking();

        $payload = [
            'centre_id' => $this->centre->id,
            'period_start' => now()->toDateString(),
            'period_end' => now()->toDateString(),
        ];

        $response = $this->withToken($this->admin->api_token)
            ->postJson('/api/admin/settlements', $payload)
            ->assertCreated()
            ->assertJsonPath('data.gross_amount', 112875)
            ->assertJsonPath('data.commission_amount', 5000)
            ->assertJsonPath('data.tax_amount', 7875)
            ->assertJsonPath('data.net_amount', 100000)
            ->assertJsonCount(1, 'data.items');

        $settlementId = $response->json('data.id');
        $this->assertDatabaseHas('settlements', ['id' => $settlementId, 'status' => 'pending']);
        $this->assertDatabaseCount('settlement_items', 1);

        $this->withToken($this->admin->api_token)
            ->postJson('/api/admin/settlements', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('period_start');

        $this->withToken($this->owner->api_token)
            ->getJson('/api/owner/accounting')
            ->assertOk()
            ->assertJsonPath('summary.settlement_payable', 100000)
            ->assertJsonPath('settlements.0.id', $settlementId);
    }

    public function test_settlement_enforces_approval_and_payment_reference(): void
    {
        $this->createPaidBooking();
        $settlementId = $this->withToken($this->admin->api_token)->postJson('/api/admin/settlements', [
            'centre_id' => $this->centre->id,
            'period_start' => now()->toDateString(),
            'period_end' => now()->toDateString(),
        ])->json('data.id');

        $this->withToken($this->admin->api_token)
            ->patchJson("/api/admin/settlements/{$settlementId}", ['status' => 'paid', 'payment_reference' => 'BANK-1'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->withToken($this->admin->api_token)
            ->patchJson("/api/admin/settlements/{$settlementId}", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->withToken($this->admin->api_token)
            ->patchJson("/api/admin/settlements/{$settlementId}", ['status' => 'paid'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_reference');

        $this->withToken($this->admin->api_token)
            ->patchJson("/api/admin/settlements/{$settlementId}", [
                'status' => 'paid',
                'payment_method' => 'Bank Transfer',
                'payment_reference' => 'BANK-2026-001',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.payment_reference', 'BANK-2026-001');

        $this->assertDatabaseHas('settlements', [
            'id' => $settlementId,
            'status' => 'paid',
            'payment_reference' => 'BANK-2026-001',
        ]);
    }

    public function test_commission_rate_change_only_affects_future_quotes(): void
    {
        $service = app(BookingService::class);
        $before = $service->quote($this->centre, 'full_day', 100, []);
        $this->assertSame(5000.0, $before['service_charge']);

        $this->withToken($this->admin->api_token)
            ->patchJson("/api/admin/centres/{$this->centre->id}/commission", ['commission_rate' => 7.5])
            ->assertOk()
            ->assertJsonPath('commission_rate', 7.5);

        $after = $service->quote($this->centre->fresh(), 'full_day', 100, []);
        $this->assertSame(7500.0, $after['service_charge']);
        $this->assertSame(7.5, $after['commission_rate']);
    }

    private function createPaidBooking(): void
    {
        $service = app(BookingService::class);
        $booking = $service->create($this->centre, [
            'customer_name' => 'Paid Customer',
            'customer_phone' => '01811111111',
            'event_date' => now()->addDays(10)->toDateString(),
            'session_type' => 'full_day',
            'guest_count' => 100,
            'payment_option' => 'full',
        ]);
        $service->applyPayment($booking, 'Bank Transfer', 'full');
    }
}
