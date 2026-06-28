<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\FoodMenu;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class FlexibleBookingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private CommunityCentre $centre;
    private FoodMenu $menuOne;
    private FoodMenu $menuTwo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => 'owner',
            'api_token' => Str::random(72),
        ]);
        $this->centre = CommunityCentre::create([
            'owner_id' => $this->owner->id,
            'name' => 'Flexible Centre',
            'slug' => 'flexible-centre',
            'area' => 'Dhanmondi',
            'capacity' => 500,
            'base_price' => 50000,
            'half_day_price' => 50000,
            'full_day_price' => 100000,
            'commission_rate' => 5,
            'status' => 'active',
        ]);
        $this->menuOne = FoodMenu::create([
            'centre_id' => $this->centre->id,
            'name' => 'Dinner',
            'price_per_person' => 500,
            'min_guest_count' => 20,
            'status' => 'active',
        ]);
        $this->menuTwo = FoodMenu::create([
            'centre_id' => $this->centre->id,
            'name' => 'Snacks',
            'price_per_person' => 300,
            'min_guest_count' => 10,
            'status' => 'active',
        ]);
    }

    public function test_owner_can_create_multi_menu_booking_with_discount_and_custom_payment(): void
    {
        $response = $this->withToken($this->owner->api_token)->postJson('/api/owner/bookings', [
            'customer_name' => 'Flexible Customer',
            'customer_phone' => '01811111111',
            'customer_email' => 'flex@example.com',
            'event_date' => now()->addDays(12)->toDateString(),
            'session_type' => 'full_day',
            'booking_dates' => [
                ['date' => now()->addDays(12)->toDateString(), 'session_type' => 'full_day'],
                ['date' => now()->addDays(14)->toDateString(), 'session_type' => 'half_day_morning'],
            ],
            'guest_count' => 100,
            'event_type' => 'Corporate event',
            'food_selections' => [
                ['food_menu_id' => $this->menuOne->id, 'quantity' => 100],
                ['food_menu_id' => $this->menuTwo->id, 'quantity' => 50],
            ],
            'adjustment_amount' => -1000,
            'adjustment_reason' => 'Partner discount',
            'notes' => 'Use the service entrance for setup.',
            'mark_paid' => true,
            'payment_option' => 'advance',
            'payment_method' => 'Cash',
            'custom_payment_amount' => 25000,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.adjustment_amount', -1000)
            ->assertJsonPath('data.adjustment_reason', 'Partner discount')
            ->assertJsonPath('data.notes', 'Use the service entrance for setup.')
            ->assertJsonPath('data.paid_amount', 25000)
            ->assertJsonPath('data.payment_option', 'advance')
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.date_count', 2)
            ->assertJsonCount(2, 'data.booking_dates')
            ->assertJsonCount(2, 'data.food_items');

        $bookingId = $response->json('data.id');
        $this->assertDatabaseHas('bookings', [
            'id' => $bookingId,
            'adjustment_amount' => -1000,
            'adjustment_reason' => 'Partner discount',
            'paid_amount' => 25000,
        ]);
        $this->assertDatabaseCount('booking_food_items', 2);
        $this->assertDatabaseCount('booking_dates', 2);
        $this->assertDatabaseHas('booking_dates', ['booking_id' => $bookingId, 'date' => now()->addDays(14)->toDateString(), 'session_type' => 'half_day_morning']);
        $this->assertDatabaseHas('crm_contacts', ['centre_id' => $this->centre->id, 'phone' => '01811111111', 'stage' => 'customer']);
        $this->assertDatabaseHas('payments', [
            'booking_id' => $bookingId,
            'amount' => 25000,
            'payment_method' => 'Cash',
        ]);
    }

    public function test_manual_adjustment_requires_an_audit_reason(): void
    {
        $this->withToken($this->owner->api_token)->postJson('/api/owner/bookings', [
            'customer_name' => 'Discount Customer',
            'customer_phone' => '01822222222',
            'event_date' => now()->addDays(14)->toDateString(),
            'session_type' => 'half_day_morning',
            'guest_count' => 50,
            'adjustment_amount' => -5000,
            'mark_paid' => false,
        ])->assertUnprocessable()->assertJsonValidationErrors('adjustment_reason');

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_custom_payment_cannot_exceed_booking_total(): void
    {
        $this->withToken($this->owner->api_token)->postJson('/api/owner/bookings', [
            'customer_name' => 'Overpayment Customer',
            'customer_phone' => '01833333333',
            'event_date' => now()->addDays(16)->toDateString(),
            'session_type' => 'half_day_evening',
            'guest_count' => 40,
            'mark_paid' => true,
            'payment_option' => 'advance',
            'payment_method' => 'Cash',
            'custom_payment_amount' => 999999,
        ])->assertUnprocessable()->assertJsonValidationErrors('custom_payment_amount');

        $this->assertDatabaseCount('bookings', 0);
        $this->assertDatabaseCount('availability_slots', 0);
        $this->assertDatabaseCount('crm_contacts', 0);
    }

    public function test_cancelling_multi_date_booking_releases_every_slot(): void
    {
        $response = $this->withToken($this->owner->api_token)->postJson('/api/owner/bookings', [
            'customer_name' => 'Series Customer',
            'customer_phone' => '01844444444',
            'event_date' => now()->addDays(20)->toDateString(),
            'session_type' => 'full_day',
            'booking_dates' => [
                ['date' => now()->addDays(20)->toDateString(), 'session_type' => 'full_day'],
                ['date' => now()->addDays(22)->toDateString(), 'session_type' => 'half_day_evening'],
            ],
            'guest_count' => 80,
            'mark_paid' => false,
        ])->assertCreated();

        $this->assertDatabaseCount('availability_slots', 4);

        $this->withToken($this->owner->api_token)
            ->patchJson('/api/owner/bookings/'.$response->json('data.booking_no').'/status', ['action' => 'cancel', 'reason' => 'Event postponed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonCount(2, 'data.booking_dates');

        $this->assertDatabaseMissing('availability_slots', ['status' => 'booked']);
    }
}
