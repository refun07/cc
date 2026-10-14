<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminPaymentsReportTest extends TestCase
{
    use RefreshDatabase;

    private function centre(string $name, string $type): CommunityCentre
    {
        return CommunityCentre::create([
            'name' => $name, 'slug' => Str::slug($name), 'area' => 'Wari',
            'centre_type' => $type, 'capacity' => 100, 'base_price' => 1000,
            'half_day_price' => 1000, 'full_day_price' => 2000, 'status' => 'active',
        ]);
    }

    private function payment(CommunityCentre $centre, string $number, string $paidAt, int $amount): Payment
    {
        $booking = Booking::create([
            'booking_no' => $number, 'centre_id' => $centre->id,
            'customer_name' => 'Customer', 'customer_phone' => '01911111111',
            'event_date' => '2026-11-01', 'session_type' => 'full_day',
            'status' => 'confirmed', 'vat_amount' => 70, 'service_charge' => 50,
        ]);

        return Payment::create([
            'booking_id' => $booking->id, 'payment_method' => 'Cash',
            'amount' => $amount, 'status' => 'paid', 'paid_at' => $paidAt,
        ]);
    }

    public function test_admin_filters_payments_by_paid_date_type_and_centre_with_matching_totals(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $customer = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $convention = $this->centre('Wari Convention Centre', 'convention_centre');
        $community = $this->centre('Wari Community Centre', 'community_centre');
        $this->payment($convention, 'PAY-1', '2026-10-10 00:00:00', 1000);
        $this->payment($convention, 'PAY-2', '2026-10-11 23:59:59', 2000);
        $this->payment($convention, 'PAY-3', '2026-10-12 00:00:00', 3000);
        $this->payment($community, 'PAY-4', '2026-10-11 12:00:00', 4000);

        $url = '/api/admin/payments?from=2026-10-10&to=2026-10-11&centre_type=convention_centre&centre_id='.$convention->id;
        $this->withToken($customer->api_token)->getJson($url)->assertForbidden();
        $this->withToken($admin->api_token)->getJson($url)->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('totals.amount', 3000)
            ->assertJsonPath('totals.vat', 140)
            ->assertJsonPath('totals.commission', 100)
            ->assertJsonPath('data.0.booking_no', 'PAY-2')
            ->assertJsonPath('data.1.booking_no', 'PAY-1');
        $this->withToken($admin->api_token)->getJson('/api/admin/payments?from=2026-10-12&to=2026-10-11')
            ->assertUnprocessable();

        $this->withToken($admin->api_token)->patchJson("/api/admin/centres/{$community->id}/type", [
            'centre_type' => 'banquet_hall',
        ])->assertOk()->assertJsonPath('data.centre_type', 'banquet_hall');
        $this->withToken($admin->api_token)->getJson('/api/admin/payments?centre_type=banquet_hall')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.booking_no', 'PAY-4');
    }

    public function test_payment_report_paginates_without_dropping_older_records(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $centre = $this->centre('Test Community Centre', 'community_centre');
        for ($index = 1; $index <= 51; $index++) {
            $this->payment($centre, "PAY-{$index}", '2026-10-10 12:00:00', 10);
        }

        $this->withToken($admin->api_token)->getJson('/api/admin/payments?page=2')
            ->assertOk()->assertJsonPath('meta.total', 51)
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('totals.amount', 510);
    }
}
