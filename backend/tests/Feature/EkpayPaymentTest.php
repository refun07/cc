<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\PaymentAttempt;
use App\Models\User;
use App\Services\EkpayPayments;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class EkpayPaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $other;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $this->customer = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $this->other = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $centre = CommunityCentre::create([
            'owner_id' => $owner->id,
            'name' => 'Test Centre',
            'slug' => 'test-centre',
            'area' => 'Dhaka',
            'capacity' => 100,
            'base_price' => 100,
            'full_day_price' => 100,
            'half_day_price' => 50,
            'status' => 'active',
        ]);
        $this->booking = Booking::create([
            'booking_no' => 'DSCC-TESTPAY',
            'user_id' => $this->customer->id,
            'centre_id' => $centre->id,
            'customer_name' => 'Test Customer',
            'customer_phone' => '01921805176',
            'event_date' => now()->addWeek()->toDateString(),
            'session_type' => 'full_day',
            'total_amount' => '1000.00',
            'advance_amount' => '300.00',
            'paid_amount' => '0.00',
            'due_amount' => '1000.00',
            'status' => 'payment_pending',
        ]);
        config()->set('services.ekpay', [
            'merchant_id' => 'dscc_community_center_test',
            'password' => 'test-only-password',
            'base_url' => 'https://sandbox.ekpay.gov.bd/ekpaypg',
            'mac_addr' => '103.30.30.193',
        ]);
    }

    public function test_test_merchant_cannot_target_production_and_payment_requires_owner(): void
    {
        config()->set('services.ekpay.base_url', 'https://pg.ekpay.gov.bd/ekpaypg');
        $this->getJson('/api/payments/availability')->assertOk()->assertJsonPath('online_available', false);
        $this->withToken($this->customer->api_token)->postJson('/api/payments/initiate', [
            'booking_no' => $this->booking->booking_no,
        ])->assertStatus(503);

        config()->set('services.ekpay.base_url', 'https://sandbox.ekpay.gov.bd/ekpaypg');
        config()->set('services.ekpay.mac_addr', null);
        $this->getJson('/api/payments/availability')->assertOk()->assertJsonPath('online_available', false);
        config()->set('services.ekpay.mac_addr', '103.30.30.193');
        $this->withToken($this->other->api_token)->postJson('/api/payments/initiate', [
            'booking_no' => $this->booking->booking_no,
        ])->assertForbidden();
        $this->assertDatabaseCount('payment_attempts', 0);
    }

    public function test_redirect_and_forged_notification_do_not_mark_booking_paid(): void
    {
        $this->fakeGateway('999.00');
        $url = $this->withToken($this->customer->api_token)->postJson('/api/payments/initiate', [
            'booking_no' => $this->booking->booking_no,
            'payment_option' => 'advance',
        ])->assertOk()->json('redirect_url');
        $attempt = PaymentAttempt::firstOrFail();
        $this->assertMatchesRegularExpression('/^ICCMS[A-Z0-9]{23}$/', $attempt->transaction_id);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/v1/merchant-api')
            && $request['mac_addr'] === '103.30.30.193');
        $this->assertStringStartsWith('https://sandbox.ekpay.gov.bd/ekpaypg/v1?', $url);
        $this->assertSame(30000, EkpayPayments::cents($attempt->amount));
        $this->assertNotSame('test-token-12345678901234567890', $attempt->getRawOriginal('secure_token'));
        $this->assertSame(0, EkpayPayments::cents($this->booking->fresh()->paid_amount));

        $this->postJson('/api/payments/ekpay/ipn', [
            'trnx_info' => ['mer_trnx_id' => $attempt->transaction_id, 'trnx_amt' => '300.00'],
            'msg_code' => '1020',
        ])->assertOk();
        $this->get('/api/payments/ekpay/return/success?trnsId='.$attempt->transaction_id)
            ->assertRedirect('/booking/'.$this->booking->booking_no.'?payment=pending');
        $this->assertSame(0, EkpayPayments::cents($this->booking->fresh()->paid_amount));
        $this->assertSame('pending', $attempt->fresh()->status);
    }

    public function test_verified_payment_is_applied_once_after_gateway_search(): void
    {
        $this->fakeGateway('300.00');
        $this->withToken($this->customer->api_token)->postJson('/api/payments/initiate', [
            'booking_no' => $this->booking->booking_no,
            'payment_option' => 'advance',
        ])->assertOk();
        $attempt = PaymentAttempt::firstOrFail();

        $callback = ['trnx_info' => ['mer_trnx_id' => $attempt->transaction_id]];
        $this->postJson('/api/payments/ekpay/ipn', $callback)->assertOk();
        $this->postJson('/api/payments/ekpay/ipn', $callback)->assertOk();
        $this->get('/api/payments/ekpay/return/success?trnsId='.$attempt->transaction_id)
            ->assertRedirect('/booking/'.$this->booking->booking_no.'?payment=paid');

        $this->assertSame(30000, EkpayPayments::cents($this->booking->fresh()->paid_amount));
        $this->assertSame(70000, EkpayPayments::cents($this->booking->fresh()->due_amount));
        $this->assertSame('paid', $attempt->fresh()->status);
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseHas('payments', ['booking_id' => $this->booking->id, 'amount' => 300]);
        $this->assertDatabaseCount('payment_receipts', 1);
        $this->assertDatabaseHas('payment_receipts', ['booking_id' => $this->booking->id, 'amount' => 300, 'source' => 'ekpay']);
    }

    public function test_offline_then_online_preserves_both_receipts_and_duplicate_callbacks(): void
    {
        app(\App\Services\BookingService::class)->applyPayment($this->booking, 'Cash', 'custom', 400);
        $attempt = $this->booking->paymentAttempts()->create([
            'transaction_id' => 'ICCMS'.str_repeat('B', 23), 'amount' => '600.00', 'status' => 'pending', 'initiated_at' => now(),
        ]);
        $this->fakeGateway('600.00');
        $callback = ['trnx_info' => ['mer_trnx_id' => $attempt->transaction_id]];
        $this->postJson('/api/payments/ekpay/ipn', $callback)->assertOk();
        $this->postJson('/api/payments/ekpay/ipn', $callback)->assertOk();
        $this->assertDatabaseCount('payment_receipts', 2);
        $this->assertDatabaseCount('payments', 1);
        $this->assertEquals(1000, \App\Models\PaymentReceipt::sum('amount'));
        $this->assertEquals(1000, $this->booking->fresh()->payment->amount);
    }

    public function test_existing_dscc_transaction_callbacks_remain_valid(): void
    {
        $attempt = $this->booking->paymentAttempts()->create([
            'transaction_id' => 'DSCC'.str_repeat('A', 24),
            'amount' => '300.00',
            'status' => 'pending',
            'initiated_at' => now(),
        ]);
        $this->fakeGateway('999.00');

        $this->postJson('/api/payments/ekpay/ipn', [
            'trnx_info' => ['mer_trnx_id' => $attempt->transaction_id],
        ])->assertOk();
        $this->get('/api/payments/ekpay/return/success?trnsId='.$attempt->transaction_id)
            ->assertRedirect('/booking/'.$this->booking->booking_no.'?payment=pending');
        $this->assertSame('pending', $attempt->fresh()->status);
    }

    public function test_public_sandbox_on_production_is_limited_to_the_test_customer(): void
    {
        app()->detectEnvironment(fn () => 'production');
        config()->set('app.url', 'https://iccms.dscc.gov.bd');
        config()->set('services.ekpay.sandbox_tester_phone', '01921805176');
        $this->customer->update(['phone' => '01921805176']);

        $this->getJson('/api/payments/availability')->assertOk()->assertJsonPath('online_available', false);
        $this->withToken($this->other->api_token)->getJson('/api/payments/availability')
            ->assertOk()->assertJsonPath('online_available', false);
        $this->withToken($this->other->api_token)->postJson('/api/payments/initiate', [
            'booking_no' => $this->booking->booking_no,
        ])->assertForbidden();
        $this->assertDatabaseCount('payment_attempts', 0);

        $this->fakeGateway('1000.00');
        $this->customer->update(['status' => 'suspended']);
        $this->withToken($this->customer->api_token)->getJson('/api/payments/availability')
            ->assertOk()->assertJsonPath('online_available', false);
        $this->customer->update(['status' => 'active']);
        $this->withToken($this->customer->api_token)->getJson('/api/payments/availability')
            ->assertOk()->assertJsonPath('online_available', true);
        $this->withToken($this->customer->api_token)->postJson('/api/payments/initiate', [
            'booking_no' => $this->booking->booking_no,
        ])->assertOk()->assertJsonStructure(['redirect_url']);
        $this->assertDatabaseCount('payment_attempts', 1);
    }

    private function fakeGateway(string $verifiedAmount): void
    {
        Http::fake(function ($request) use ($verifiedAmount) {
            if (str_ends_with($request->url(), '/v1/merchant-api')) {
                return Http::response(['secure_token' => 'test-token-12345678901234567890', 'msg_code' => '1000'], 200);
            }
            $attempt = PaymentAttempt::firstOrFail();
            return Http::response([
                'msg_code' => '1020',
                'basic_Info' => ['mer_reg_id' => 'dscc_community_center_test'],
                'trnx_info' => [
                    'mer_trnx_id' => $attempt->transaction_id,
                    'trnx_amt' => $verifiedAmount,
                    'curr' => 'BDT',
                    'trnx_id' => 'GATEWAY-123',
                ],
            ], 200);
        });
    }
}
