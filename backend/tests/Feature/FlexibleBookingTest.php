<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\CentreFloor;
use App\Models\CentreDecorator;
use App\Models\AvailabilitySlot;
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

    public function test_owner_booking_keeps_the_selected_floor(): void
    {
        $floor = CentreFloor::create([
            'centre_id' => $this->centre->id,
            'name' => 'Ground Floor Hall',
            'capacity' => 300,
            'half_day_price' => 25000,
            'full_day_price' => 45000,
            'status' => 'active',
        ]);

        $response = $this->withToken($this->owner->api_token)->postJson('/api/owner/bookings', [
            'centre_floor_id' => $floor->id,
            'customer_name' => 'Floor Booking Customer',
            'customer_phone' => '01855555555',
            'event_date' => now()->addDays(10)->toDateString(),
            'session_type' => 'full_day',
            'guest_count' => 100,
            'event_manager_name' => 'Local Organiser',
            'event_manager_phone' => '01912345679',
            'mark_paid' => false,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.centre_floor_id', $floor->id)
            ->assertJsonPath('data.floor_name', 'Ground Floor Hall')
            ->assertJsonPath('data.event_manager_name', 'Local Organiser');

        $this->assertDatabaseHas('bookings', [
            'id' => $response->json('data.id'),
            'centre_floor_id' => $floor->id,
        ]);
    }

    public function test_same_floor_cannot_be_booked_twice_even_when_availability_row_is_missing(): void
    {
        $firstFloor = CentreFloor::create([
            'centre_id' => $this->centre->id, 'name' => 'First Floor',
            'capacity' => 300, 'half_day_price' => 25000, 'full_day_price' => 45000, 'status' => 'active',
        ]);
        $secondFloor = CentreFloor::create([
            'centre_id' => $this->centre->id, 'name' => 'Second Floor',
            'capacity' => 300, 'half_day_price' => 25000, 'full_day_price' => 45000, 'status' => 'active',
        ]);
        $date = now()->addDays(18)->toDateString();
        $book = fn ($floorId, $session) => $this->withToken($this->owner->api_token)
            ->postJson('/api/owner/bookings', [
                'centre_floor_id' => $floorId,
                'customer_name' => 'Floor Customer',
                'customer_phone' => '01855555555',
                'event_date' => $date,
                'session_type' => $session,
                'guest_count' => 100,
                'mark_paid' => false,
            ]);

        $book($firstFloor->id, 'half_day_morning')->assertCreated();
        AvailabilitySlot::where('centre_floor_id', $firstFloor->id)->delete();
        $this->getJson("/api/centres/{$this->centre->slug}/calendar?from={$date}&to={$date}&floor_id={$firstFloor->id}")
            ->assertOk()->assertJsonPath('data.0.full_day', false)
            ->assertJsonPath('data.0.half_day_morning', false)
            ->assertJsonPath('data.0.half_day_evening', true);
        $book($firstFloor->id, 'half_day_morning')->assertUnprocessable();
        $book($firstFloor->id, 'full_day')->assertUnprocessable();
        $book($firstFloor->id, 'half_day_evening')->assertCreated();
        $book($secondFloor->id, 'full_day')->assertCreated();
        $this->assertDatabaseCount('bookings', 3);
    }

    public function test_customer_nid_is_required_once_and_never_returned_by_auth_api(): void
    {
        $customer = User::factory()->create([
            'role' => 'customer', 'phone' => '01912345678', 'api_token' => Str::random(72),
        ]);
        $payload = [
            'centre_slug' => $this->centre->slug,
            'event_date' => now()->addDays(24)->toDateString(),
            'session_type' => 'full_day',
            'guest_count' => 100,
        ];

        $this->withToken($customer->api_token)->postJson('/api/bookings', [
            ...$payload, 'nid_number' => '1234567890', 'payment_option' => 'later',
        ])->assertUnprocessable()->assertJsonValidationErrors('payment_option');

        $this->withToken($customer->api_token)->postJson('/api/bookings', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('nid_number');
        foreach (['12345678910', '1234567890', '1111111111'] as $invalidNid) {
            $this->withToken($customer->api_token)->postJson('/api/bookings', [
                ...$payload, 'nid_number' => $invalidNid,
            ])->assertUnprocessable()->assertJsonValidationErrors('nid_number');
        }
        $this->withToken($customer->api_token)->postJson('/api/bookings', [
            ...$payload, 'nid_number' => '3216549870', 'event_manager_name' => 'Event Lead',
        ])->assertUnprocessable()->assertJsonValidationErrors('event_manager_phone');
        $decorator = CentreDecorator::create([
            'centre_id' => $this->centre->id, 'name' => 'Venue Decorator', 'phone' => '01812345678',
            'service_area' => 'Dhanmondi', 'status' => 'active',
        ]);
        $created = $this->withToken($customer->api_token)->postJson('/api/bookings', [
            ...$payload, 'nid_number' => '3216549870', 'decorator_id' => $decorator->id,
            'event_manager_name' => 'Event Lead', 'event_manager_phone' => '01912345679',
        ])->assertCreated()->assertJsonPath('data.event_manager_name', 'Event Lead')
            ->assertJsonPath('data.event_manager_phone', '01912345679')
            ->assertJsonPath('data.decorator_name', 'Venue Decorator')
            ->assertJsonPath('data.decorator_phone', '01812345678');
        $bookingNo = $created->json('data.booking_no');
        $this->withToken($customer->api_token)->patchJson("/api/bookings/{$bookingNo}/details", [
            'customer_name' => $customer->name, 'customer_phone' => $customer->phone,
            'event_manager_name' => null, 'event_manager_phone' => null,
        ])->assertOk()->assertJsonPath('data.event_manager_name', null);
        $this->assertSame('3216549870', $customer->fresh()->nid_number);
        $this->assertStringNotContainsString('3216549870', \DB::table('users')->where('id', $customer->id)->value('nid_number'));
        $this->withToken($customer->api_token)->getJson('/api/auth/me')
            ->assertOk()->assertJsonPath('user.nid_saved', true)
            ->assertDontSee('3216549870');

        $this->assertDatabaseHas('bookings', [
            'booking_no' => $bookingNo,
            'centre_decorator_id' => $decorator->id,
            'decorator_name' => 'Venue Decorator',
            'decorator_phone' => '01812345678',
        ]);
        $decorator->update(['status' => 'inactive']);
        $this->withToken($customer->api_token)->postJson('/api/bookings', [
            ...$payload,
            'event_date' => now()->addDays(25)->toDateString(),
            'decorator_id' => $decorator->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('decorator_id');

        $this->withToken($customer->api_token)->postJson('/api/bookings', [
            ...$payload,
            'event_date' => now()->addDays(25)->toDateString(),
        ])->assertCreated();
    }

    public function test_existing_obviously_invalid_nid_must_be_replaced_before_booking(): void
    {
        $customer = User::factory()->create([
            'role' => 'customer', 'phone' => '01912345678', 'api_token' => Str::random(72),
            'nid_number' => '1234567890',
        ]);
        $this->withToken($customer->api_token)->getJson('/api/auth/me')
            ->assertOk()->assertJsonPath('user.nid_saved', false);

        $payload = [
            'centre_slug' => $this->centre->slug,
            'event_date' => now()->addDays(24)->toDateString(),
            'session_type' => 'full_day',
            'guest_count' => 100,
        ];
        $this->withToken($customer->api_token)->postJson('/api/bookings', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('nid_number');
        $this->withToken($customer->api_token)->postJson('/api/bookings', [
            ...$payload, 'nid_number' => '3216549870',
        ])->assertCreated();
        $this->assertSame('3216549870', $customer->fresh()->nid_number);
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
