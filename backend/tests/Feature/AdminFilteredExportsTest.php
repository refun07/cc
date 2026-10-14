<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminFilteredExportsTest extends TestCase
{
    use RefreshDatabase;

    private function centre(string $name, string $type, string $area = 'Wari'): CommunityCentre
    {
        return CommunityCentre::create([
            'name' => $name, 'slug' => Str::slug($name), 'area' => $area,
            'centre_type' => $type, 'capacity' => 100, 'base_price' => 1000,
            'half_day_price' => 1000, 'full_day_price' => 2000, 'status' => 'active',
        ]);
    }

    private function record(CommunityCentre $centre, string $number, string $date, string $bookingStatus, string $paymentStatus): void
    {
        $booking = Booking::create([
            'booking_no' => $number, 'centre_id' => $centre->id,
            'customer_name' => '=1+1', 'customer_phone' => '01911111111',
            'event_date' => '2026-11-01', 'session_type' => 'full_day',
            'status' => $bookingStatus, 'created_at' => $date,
            'total_amount' => 100, 'paid_amount' => 100,
            'vat_amount' => 7, 'service_charge' => 5,
        ]);
        Payment::create([
            'booking_id' => $booking->id, 'payment_method' => 'Cash',
            'transaction_id' => $number, 'amount' => 100,
            'status' => $paymentStatus, 'paid_at' => $date,
        ]);
    }

    public function test_csv_exports_follow_date_centre_type_centre_and_relevant_status_filters(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $customer = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $community = $this->centre('Wari Community Centre', 'community_centre');
        $convention = $this->centre('Wari Convention Centre', 'convention_centre');
        $otherArea = $this->centre('Gulshan Community Centre', 'community_centre', 'Gulshan');
        $this->record($community, 'MATCH-1', '2026-10-11 23:59:59', 'confirmed', 'paid');
        $this->record($community, 'LATE-2', '2026-10-12 00:00:00', 'confirmed', 'paid');
        $this->record($convention, 'TYPE-3', '2026-10-11 12:00:00', 'confirmed', 'paid');
        $this->record($community, 'STATUS-4', '2026-10-11 12:00:00', 'cancelled', 'refunded');
        $this->record($otherArea, 'AREA-5', '2026-10-11 12:00:00', 'confirmed', 'paid');

        $base = 'from=2026-10-11&to=2026-10-11&centre_type=community_centre&centre_name=Wari&area=Wari';
        $this->withToken($customer->api_token)->get('/api/admin/export/bookings?'.$base)->assertForbidden();

        $bookings = $this->withToken($admin->api_token)->get('/api/admin/export/bookings?'.$base.'&booking_status=confirmed');
        $bookings->assertOk()->assertHeader('X-Export-Count', '1');
        $this->assertStringContainsString('MATCH-1', $bookings->getContent());
        $this->assertStringContainsString("'=1+1", $bookings->getContent());
        $this->assertStringNotContainsString('LATE-2', $bookings->getContent());
        $this->assertStringNotContainsString('TYPE-3', $bookings->getContent());
        $this->assertStringNotContainsString('STATUS-4', $bookings->getContent());
        $this->assertStringNotContainsString('AREA-5', $bookings->getContent());

        $payments = $this->withToken($admin->api_token)->get('/api/admin/export/payments?'.$base.'&payment_status=paid');
        $payments->assertOk()->assertHeader('X-Export-Count', '1');
        $this->assertStringContainsString('MATCH-1', $payments->getContent());
        $this->assertStringNotContainsString('STATUS-4', $payments->getContent());
        $this->assertStringNotContainsString('LATE-2', $payments->getContent());
        $this->assertStringNotContainsString('TYPE-3', $payments->getContent());
        $this->assertStringNotContainsString('AREA-5', $payments->getContent());
        $this->withToken($admin->api_token)->get('/api/admin/export/bookings?centre_id='.$community->id)
            ->assertOk()->assertHeader('X-Export-Count', '3');

        $this->withToken($admin->api_token)->getJson('/api/admin/reports?'.$base.'&booking_status=confirmed')
            ->assertOk()->assertJsonPath('totals.bookings', 1)
            ->assertJsonPath('totals.gmv', 100)
            ->assertJsonPath('totals.vat', 7)
            ->assertJsonPath('trend.0.bookings', 1)
            ->assertJsonPath('booking_growth.0.bookings', 1)
            ->assertJsonPath('by_status.0.status', 'confirmed');
        $this->withToken($admin->api_token)->getJson('/api/admin/reports?'.$base)
            ->assertOk()->assertJsonPath('totals.bookings', 2)
            ->assertJsonPath('totals.gmv', 100)
            ->assertJsonPath('trend.0.bookings', 2)
            ->assertJsonPath('trend.0.gmv', 100);
        $this->withToken($admin->api_token)->getJson('/api/admin/export/payments?from=2026-10-12&to=2026-10-11')
            ->assertUnprocessable();
    }
}
