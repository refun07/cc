<?php

namespace Tests\Feature;

use App\Models\CentreFloor;
use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerBookingSafetyTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private CommunityCentre $centre;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        $owner = User::factory()->create(['role' => 'owner']);
        $this->customer = User::factory()->create(['role' => 'customer', 'phone' => '01700000000', 'api_token' => Str::random(72)]);
        $this->centre = CommunityCentre::create([
            'owner_id' => $owner->id, 'name' => 'Safety Test Centre', 'slug' => 'safety-test',
            'area' => 'Dhaka', 'capacity' => 100, 'base_price' => 100000,
            'full_day_price' => 100000, 'half_day_price' => 50000,
            'commission_rate' => 5, 'status' => 'active',
        ]);
        $this->withToken($this->customer->api_token);
    }

    private function payload(array $extra = []): array
    {
        return array_merge([
            'centre_slug' => $this->centre->slug,
            'customer_name' => 'Test Customer', 'nid_number' => '3216549870',
            'event_date' => now()->addDays(20)->toDateString(),
            'session_type' => 'full_day', 'guest_count' => 40, 'payment_option' => 'advance',
        ], $extra);
    }

    public function test_changed_quote_is_rejected_before_any_booking_side_effects(): void
    {
        $total = $this->postJson('/api/bookings/quote', $this->payload())->assertOk()->json('data.total_amount');
        $this->centre->update(['full_day_price' => 110000]);
        $this->postJson('/api/bookings', $this->payload(['expected_total_amount' => $total]))
            ->assertUnprocessable()->assertJsonValidationErrors('expected_total_amount');
        foreach (['bookings', 'booking_dates', 'availability_slots', 'payment_attempts', 'payments', 'crm_contacts'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
        $this->assertNull($this->customer->fresh()->nid_number);
    }

    public function test_matching_quote_accepts_decimal_string_and_keeps_advance_plan(): void
    {
        $this->postJson('/api/bookings', $this->payload(['expected_total_amount' => '112875.00']))
            ->assertCreated()->assertJsonPath('data.total_amount', 112875)
            ->assertJsonPath('data.payment_option', 'advance')->assertJsonPath('data.paid_amount', 0);
    }

    public function test_expected_total_remains_optional_for_existing_clients(): void
    {
        $this->postJson('/api/bookings', $this->payload())->assertCreated();
    }

    public function test_cash_booking_does_not_create_a_payment_or_mark_customer_paid(): void
    {
        $this->postJson('/api/bookings', $this->payload([
            'payment_method' => 'Cash', 'payment_option' => 'full',
            'paid_amount' => 112875, 'status' => 'confirmed',
        ]))->assertCreated()
            ->assertJsonPath('data.status', 'payment_pending')
            ->assertJsonPath('data.paid_amount', 0);
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseCount('payment_receipts', 0);
        $this->assertDatabaseCount('payment_attempts', 0);
        Http::assertNothingSent();
    }

    public function test_expected_total_rejects_invalid_precision_and_one_cent_difference(): void
    {
        foreach (['112875.001', '112875.01', '-1', 'not-money', null] as $amount) {
            $this->postJson('/api/bookings', $this->payload(['expected_total_amount' => $amount]))
                ->assertUnprocessable()->assertJsonValidationErrors('expected_total_amount');
        }
        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_customer_edit_obeys_centre_capacity_and_accepts_boundary(): void
    {
        $number = $this->postJson('/api/bookings', $this->payload())->assertCreated()->json('data.booking_no');
        $this->patchJson("/api/bookings/{$number}/details", $this->details(101))
            ->assertUnprocessable()->assertJsonValidationErrors('guest_count');
        $this->assertDatabaseHas('bookings', ['booking_no' => $number, 'guest_count' => 40]);
        $this->patchJson("/api/bookings/{$number}/details", $this->details(100))
            ->assertOk()->assertJsonPath('data.guest_count', 100);
    }

    public function test_customer_edit_uses_booked_floor_capacity_even_after_confirmation(): void
    {
        $floor = CentreFloor::create([
            'centre_id' => $this->centre->id, 'name' => 'Small Hall', 'capacity' => 50,
            'full_day_price' => 10000, 'half_day_price' => 5000, 'status' => 'active',
        ]);
        $number = $this->postJson('/api/bookings', $this->payload(['centre_floor_id' => $floor->id]))
            ->assertCreated()->json('data.booking_no');
        \App\Models\Booking::where('booking_no', $number)->update(['status' => 'confirmed']);
        $this->patchJson("/api/bookings/{$number}/details", $this->details(51))
            ->assertUnprocessable()->assertJsonValidationErrors('guest_count');
        $this->patchJson("/api/bookings/{$number}/details", $this->details(50))
            ->assertOk()->assertJsonPath('data.guest_count', 50);
        $floor->update(['capacity' => 0]);
        $this->patchJson("/api/bookings/{$number}/details", $this->details(101))->assertUnprocessable();
        $this->patchJson("/api/bookings/{$number}/details", $this->details(100))->assertOk();
    }

    private function details(int $guests): array
    {
        return ['customer_name' => 'Test Customer', 'customer_phone' => '01700000000', 'guest_count' => $guests];
    }
}
