<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class FeedbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_centre_review_requires_completed_booking_and_is_public_without_phone(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'phone' => '01911111111', 'api_token' => Str::random(72)]);
        $centre = CommunityCentre::create([
            'name' => 'Review Centre', 'slug' => 'review-centre', 'area' => 'Dhanmondi',
            'capacity' => 100, 'base_price' => 1000, 'half_day_price' => 1000,
            'full_day_price' => 2000, 'status' => 'active',
        ]);
        $payload = ['rating' => 4, 'comment' => 'Good service and a clean hall.'];

        $this->withToken($customer->api_token)->postJson("/api/centres/{$centre->slug}/reviews", $payload)
            ->assertForbidden();

        Booking::create([
            'booking_no' => 'REVIEW-1', 'user_id' => $customer->id,
            'centre_id' => $centre->id, 'customer_name' => $customer->name,
            'customer_phone' => $customer->phone, 'event_date' => now()->subDay()->toDateString(),
            'session_type' => 'full_day', 'status' => 'completed',
        ]);

        $this->withToken($customer->api_token)->postJson("/api/centres/{$centre->slug}/reviews", $payload)
            ->assertCreated();
        $this->getJson("/api/centres/{$centre->slug}/reviews")
            ->assertOk()->assertJsonPath('data.0.rating', 4)
            ->assertJsonPath('data.0.comment', $payload['comment'])
            ->assertDontSee($customer->phone);
        $this->assertDatabaseCount('centre_reviews', 1);
        $this->assertEquals(4, $centre->fresh()->rating);
    }

    public function test_software_feedback_is_visible_to_admin_only(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);

        $this->withToken($customer->api_token)->postJson('/api/software-feedback', [
            'rating' => 5, 'comment' => 'The booking flow is clear and quick.',
        ])->assertCreated();
        $this->withToken($customer->api_token)->getJson('/api/admin/software-feedback')->assertForbidden();
        $this->withToken($admin->api_token)->getJson('/api/admin/software-feedback')
            ->assertOk()->assertJsonPath('data.data.0.rating', 5);
    }

    public function test_booking_success_feedback_allows_stars_without_comment_once_per_booking(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'phone' => '01911111113', 'api_token' => Str::random(72)]);
        $other = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $centre = CommunityCentre::create([
            'name' => 'Feedback Centre', 'slug' => 'feedback-centre', 'area' => 'Wari',
            'capacity' => 100, 'base_price' => 1000, 'half_day_price' => 1000,
            'full_day_price' => 2000, 'status' => 'active',
        ]);
        foreach (['FEEDBACK-1', 'FEEDBACK-2'] as $bookingNo) {
            Booking::create([
                'booking_no' => $bookingNo, 'user_id' => $customer->id,
                'centre_id' => $centre->id, 'customer_name' => $customer->name,
                'customer_phone' => $customer->phone,
                'event_date' => now()->addMonth()->toDateString(),
                'session_type' => 'full_day', 'status' => 'payment_pending',
            ]);
        }

        $this->withToken($customer->api_token)->getJson('/api/bookings/FEEDBACK-1/software-feedback')
            ->assertOk()->assertJsonPath('data', null);
        $this->withToken($other->api_token)->getJson('/api/bookings/FEEDBACK-1/software-feedback')->assertForbidden();
        $this->withToken($other->api_token)->postJson('/api/software-feedback', [
            'booking_no' => 'FEEDBACK-1', 'rating' => 5,
        ])->assertForbidden();
        $this->withToken($customer->api_token)->postJson('/api/software-feedback', [
            'booking_no' => 'FEEDBACK-1', 'rating' => 5,
        ])->assertCreated();
        $this->withToken($customer->api_token)->getJson('/api/bookings/FEEDBACK-1/software-feedback')
            ->assertOk()->assertJsonPath('data.rating', 5)->assertJsonPath('data.comment', null);
        $this->withToken($customer->api_token)->postJson('/api/software-feedback', [
            'booking_no' => 'FEEDBACK-1', 'rating' => 4, 'comment' => 'Easy booking flow.',
        ])->assertCreated();
        $this->withToken($customer->api_token)->postJson('/api/software-feedback', [
            'booking_no' => 'FEEDBACK-2', 'rating' => 3,
        ])->assertCreated();
        $this->assertDatabaseCount('software_feedback', 2);
        $rows = $this->withToken($admin->api_token)->getJson('/api/admin/software-feedback')
            ->assertOk()->assertJsonCount(2, 'data.data')->json('data.data');
        $byBooking = collect($rows)->keyBy('booking.booking_no');
        $this->assertSame('Easy booking flow.', $byBooking['FEEDBACK-1']['comment']);
        $this->assertSame(3, $byBooking['FEEDBACK-2']['rating']);
    }
}
