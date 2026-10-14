<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\Payment;
use App\Models\PaymentReceipt;
use App\Models\Settlement;
use App\Models\User;
use App\Services\BookingService;
use App\Services\PaymentReceipts;
use App\Services\SettlementService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ReceiptAccountingTest extends TestCase
{
    use RefreshDatabase;

    public function test_failed_payment_is_not_counted_as_collected_or_allocated_fees(): void
    {
        [$admin, , , $booking] = $this->fixture();
        Payment::create(['booking_id' => $booking->id, 'payment_method' => 'Cash', 'amount' => 1000,
            'status' => 'failed', 'paid_at' => '2026-10-01']);
        $this->withToken($admin->api_token)->getJson('/api/admin/payments')->assertJsonPath('totals.amount', 0);
        $this->pay($booking, 400, '2026-10-02');
        $this->assertEquals(400, $booking->fresh()->payment->amount);
        $this->withToken($admin->api_token)->getJson('/api/admin/payments')->assertJsonPath('totals.amount', 400)
            ->assertJsonPath('totals.vat', 28)->assertJsonPath('totals.commission', 20);
    }

    private function fixture(): array
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $centre = CommunityCentre::create(['owner_id' => $owner->id, 'name' => 'Receipt centre', 'slug' => Str::random(12),
            'area' => 'Basabo', 'capacity' => 100, 'base_price' => 880, 'status' => 'active']);
        $booking = Booking::create(['booking_no' => 'QA-'.Str::random(10), 'centre_id' => $centre->id,
            'customer_name' => 'Synthetic', 'customer_phone' => '01911111111', 'event_date' => '2027-01-01',
            'session_type' => 'full_day', 'total_amount' => 1000, 'service_charge' => 50, 'vat_amount' => 70,
            'advance_amount' => 400, 'paid_amount' => 0, 'due_amount' => 1000, 'status' => 'payment_pending']);

        return [$admin, $owner, $centre, $booking];
    }

    private function pay(Booking $booking, float $amount, string $day): void
    {
        $this->travelTo(Carbon::parse($day.' 12:00:00'));
        app(BookingService::class)->applyPayment($booking, 'Bank Transfer', 'custom', $amount);
    }

    public function test_cross_period_receipts_list_csv_and_fee_allocation(): void
    {
        [$admin, , , $booking] = $this->fixture();
        $this->pay($booking, 400, '2026-10-01');
        $first = PaymentReceipt::first();
        $this->pay($booking, 600, '2026-10-02');
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('payment_receipts', 2);
        $this->assertEquals(1000, $booking->fresh()->payment->amount);
        $this->assertEquals(400, $first->fresh()->amount);
        foreach ([['2026-10-01', 400, 28, 20], ['2026-10-02', 600, 42, 30]] as [$day, $amount, $tax, $commission]) {
            $this->withToken($admin->api_token)->getJson('/api/admin/payments?from='.$day.'&to='.$day)
                ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('totals.amount', $amount)
                ->assertJsonPath('totals.vat', $tax)->assertJsonPath('totals.commission', $commission)
                ->assertJsonPath('history.complete', true);
            $csv = $this->withToken($admin->api_token)->get('/api/admin/export/payments?from='.$day.'&to='.$day)
                ->assertOk()->assertHeader('X-Export-Count', '1')->getContent();
            $this->assertStringContainsString(','.$amount, $csv);
        }
    }

    public function test_two_partial_refunds_and_idempotent_retry(): void
    {
        [, $owner, , $booking] = $this->fixture();
        $this->pay($booking, 1000, '2026-10-01');
        $url = '/api/owner/bookings/'.$booking->booking_no.'/refund';
        $one = ['amount' => 400, 'request_key' => (string) Str::uuid()];
        $this->withToken($owner->api_token)->postJson($url, $one)->assertOk()->assertJsonPath('data.paid_amount', 600);
        $this->withToken($owner->api_token)->postJson($url, $one)->assertOk()->assertJsonPath('data.paid_amount', 600);
        $this->withToken($owner->api_token)->postJson($url, array_merge($one, ['amount' => 401]))->assertUnprocessable();
        $this->withToken($owner->api_token)->postJson($url, ['amount' => 601, 'request_key' => (string) Str::uuid()])->assertUnprocessable();
        $this->withToken($owner->api_token)->postJson($url, ['amount' => 600, 'request_key' => (string) Str::uuid()])
            ->assertOk()->assertJsonPath('data.paid_amount', 0)->assertJsonPath('data.refunded_amount', 1000);
        $this->assertDatabaseCount('payment_refunds', 2);
        $this->assertEquals(1000, PaymentReceipt::sum('refunded_amount'));
        $this->assertEquals(1000, Payment::first()->amount);
    }

    public function test_settle_advance_then_balance_once_each_with_matching_fees(): void
    {
        [$admin, , $centre, $booking] = $this->fixture();
        $service = app(SettlementService::class);
        $this->pay($booking, 400, '2026-10-01');
        $one = $service->generate($centre, ['period_start' => '2026-10-01', 'period_end' => '2026-10-01'], $admin);
        $this->assertEquals(400, $one->gross_amount);
        $this->pay($booking, 600, '2026-10-02');
        $two = $service->generate($centre, ['period_start' => '2026-10-02', 'period_end' => '2026-10-02'], $admin);
        $this->assertEquals(600, $two->gross_amount);
        $this->assertEquals(880, Settlement::sum('net_amount'));
        $this->assertEquals(70, Settlement::sum('tax_amount'));
        $this->assertEquals(50, Settlement::sum('commission_amount'));
        $this->expectException(ValidationException::class);
        $service->generate($centre, ['period_start' => '2026-10-01', 'period_end' => '2026-10-02'], $admin);
    }

    public function test_legacy_snapshot_is_idempotent_and_existing_settlement_not_duplicated(): void
    {
        [$admin, , $centre, $booking] = $this->fixture();
        $booking->update(['paid_amount' => 1000, 'due_amount' => 0, 'status' => 'confirmed']);
        $payment = Payment::create(['booking_id' => $booking->id, 'amount' => 1000, 'payment_method' => 'Bank Transfer', 'status' => 'paid', 'paid_at' => '2026-10-02']);
        $before = $payment->fresh()->getRawOriginal();
        $old = Settlement::create(['settlement_no' => 'OLD', 'centre_id' => $centre->id, 'period_start' => '2026-10-01', 'period_end' => '2026-10-01', 'gross_amount' => 400]);
        $old->items()->create(['booking_id' => $booking->id, 'gross_amount' => 400, 'commission_amount' => 20, 'tax_amount' => 28, 'net_amount' => 352]);
        DB::transaction(fn () => PaymentReceipts::preserveLegacy(Booking::whereKey($booking->id)->lockForUpdate()->first()));
        DB::transaction(fn () => PaymentReceipts::preserveLegacy(Booking::whereKey($booking->id)->lockForUpdate()->first()));
        $this->assertDatabaseCount('payment_receipts', 1);
        $this->assertSame($before, $payment->fresh()->getRawOriginal());
        $this->withToken($admin->api_token)->getJson('/api/admin/payments')->assertJsonPath('history.complete', false);
        $new = app(SettlementService::class)->generate($centre, ['period_start' => '2026-10-02', 'period_end' => '2026-10-02'], $admin);
        $this->assertEquals(600, $new->gross_amount);
        $this->assertEquals(528, $new->net_amount);
        $this->assertEquals(400, $old->fresh()->gross_amount);
    }

    public function test_refund_before_settlement_reduces_payout_and_after_reservation_is_blocked(): void
    {
        [$admin, , $centre, $booking] = $this->fixture();
        $this->pay($booking, 1000, '2026-10-01');
        app(BookingService::class)->refund($booking, 400);
        $settlement = app(SettlementService::class)->generate($centre, ['period_start' => '2026-10-01', 'period_end' => '2026-10-01'], $admin);
        $this->assertEquals(600, $settlement->gross_amount);
        $this->assertEquals(528, $settlement->net_amount);
        $this->expectException(ValidationException::class);
        app(BookingService::class)->refund($booking, 100);
    }

    public function test_cancellation_after_partial_refund_is_cumulative_and_repeat_safe(): void
    {
        [, , , $booking] = $this->fixture();
        $this->pay($booking, 1000, '2026-10-01');
        app(BookingService::class)->refund($booking, 400);
        $result = app(BookingService::class)->cancelAndRefund($booking, 'Cancelled', 600);
        $this->assertEquals(1000, $result->refunded_amount);
        $this->assertEquals(0, $result->paid_amount);
        $this->assertEquals(0, $result->due_amount);
        app(BookingService::class)->cancelAndRefund($booking, 'Repeated', 600);
        $this->assertEquals(1000, PaymentReceipt::sum('refunded_amount'));
        $this->assertDatabaseCount('payment_refunds', 2);
    }

    public function test_collect_again_after_refund_preserves_gross_history(): void
    {
        [, , , $booking] = $this->fixture();
        $this->pay($booking, 1000, '2026-10-01');
        app(BookingService::class)->refund($booking, 400);
        $this->pay($booking, 400, '2026-10-02');
        $this->assertEquals(1400, Payment::first()->amount);
        $this->assertEquals(1400, PaymentReceipt::sum('amount'));
        $this->assertEquals(400, PaymentReceipt::sum('refunded_amount'));
        $this->assertEquals(1000, $booking->fresh()->paid_amount);
    }

    public function test_offline_collection_retry_and_wrong_owner_are_safe(): void
    {
        [$admin, $owner, , $booking] = $this->fixture();
        $payload = ['booking_no' => $booking->booking_no, 'payment_method' => 'Cash', 'custom_payment_amount' => 400, 'request_key' => (string) Str::uuid()];
        $this->withToken($admin->api_token)->postJson('/api/owner/payments/offline', $payload)->assertForbidden();
        $this->withToken($owner->api_token)->postJson('/api/owner/payments/offline', $payload)->assertOk();
        $this->withToken($owner->api_token)->postJson('/api/owner/payments/offline', $payload)->assertOk();
        $this->assertDatabaseCount('payment_receipts', 1);
        $this->assertEquals(400, $booking->fresh()->paid_amount);
        $this->withToken($owner->api_token)->postJson('/api/owner/payments/offline', array_merge($payload, ['custom_payment_amount' => 300]))->assertUnprocessable();
    }

    public function test_backfill_command_preserves_all_original_financial_rows(): void
    {
        [, , , $booking] = $this->fixture();
        Payment::create(['booking_id' => $booking->id, 'payment_method' => 'Cash', 'amount' => 400, 'status' => 'paid', 'paid_at' => '2026-10-01']);
        $before = [DB::table('bookings')->get()->toJson(), DB::table('payments')->get()->toJson()];
        $this->artisan('payments:backfill-receipts')->assertSuccessful();
        $this->assertDatabaseCount('payment_receipts', 0);
        $this->artisan('payments:backfill-receipts', ['--apply' => true])->assertSuccessful();
        $this->artisan('payments:backfill-receipts', ['--apply' => true])->assertSuccessful();
        $this->assertDatabaseCount('payment_receipts', 1);
        $this->assertSame($before, [DB::table('bookings')->get()->toJson(), DB::table('payments')->get()->toJson()]);
    }

    public function test_settlements_generated_out_of_order_do_not_lose_rounding_cents(): void
    {
        [$admin, , $centre, $booking] = $this->fixture();
        $booking->update(['service_charge' => 50.01, 'vat_amount' => 70.01]);
        $this->pay($booking, 333.33, '2026-10-01');
        $this->pay($booking, 333.33, '2026-10-02');
        $this->pay($booking, 333.34, '2026-10-03');
        foreach (['2026-10-03', '2026-10-01', '2026-10-02'] as $day) {
            app(SettlementService::class)->generate($centre, ['period_start' => $day, 'period_end' => $day], $admin);
        }
        $this->assertEquals(1000, Settlement::sum('gross_amount'));
        $this->assertSame(5001, (int) round(Settlement::sum('commission_amount') * 100));
        $this->assertSame(7001, (int) round(Settlement::sum('tax_amount') * 100));
        $this->assertSame(87998, (int) round(Settlement::sum('net_amount') * 100));
    }

    public function test_legacy_advance_then_new_receipt_allocates_fees_only_once(): void
    {
        [$admin, , , $booking] = $this->fixture();
        $booking->update(['paid_amount' => 400, 'due_amount' => 600, 'status' => 'confirmed']);
        Payment::create(['booking_id' => $booking->id, 'payment_method' => 'Cash', 'amount' => 400, 'status' => 'paid', 'paid_at' => '2026-10-01']);
        $this->pay($booking, 600, '2026-10-02');
        $this->withToken($admin->api_token)->getJson('/api/admin/payments')
            ->assertOk()->assertJsonPath('totals.amount', 1000)->assertJsonPath('totals.vat', 70)->assertJsonPath('totals.commission', 50)
            ->assertJsonPath('history.legacy_aggregate_count', 1);
    }

    public function test_owner_ledger_uses_receipt_and_refund_dates_and_keeps_cancelled_cash_history(): void
    {
        [, $owner, , $booking] = $this->fixture();
        $this->pay($booking, 400, '2026-10-01');
        $this->pay($booking, 600, '2026-10-02');
        $this->travelTo(Carbon::parse('2026-10-03 12:00:00'));
        app(BookingService::class)->cancelAndRefund($booking, 'QA', 400);
        $result = $this->withToken($owner->api_token)->getJson('/api/owner/accounting')->assertOk()
            ->assertJsonPath('summary.income', 1000)->assertJsonPath('summary.expense', 400)
            ->assertJsonPath('summary.net_profit', 600)->assertJsonCount(3, 'ledger');
        $rows = collect($result->json('ledger'))->keyBy('date');
        $this->assertEquals(400, $rows['2026-10-01']['amount']);
        $this->assertEquals(600, $rows['2026-10-02']['amount']);
        $this->assertSame('expense', $rows['2026-10-03']['type']);
    }

    public function test_legacy_refund_backfill_does_not_change_owner_net_cash(): void
    {
        [, $owner, , $booking] = $this->fixture();
        $booking->update(['paid_amount' => 1000, 'refunded_amount' => 400, 'status' => 'cancelled']);
        Payment::create(['booking_id' => $booking->id, 'payment_method' => 'Cash', 'amount' => 1000,
            'refunded_amount' => 400, 'status' => 'refunded', 'paid_at' => '2026-10-01', 'refunded_at' => '2026-10-02']);
        $before = $this->withToken($owner->api_token)->getJson('/api/owner/accounting')->assertOk()->json('summary');
        $this->artisan('payments:backfill-receipts', ['--apply' => true])->assertSuccessful();
        $after = $this->withToken($owner->api_token)->getJson('/api/owner/accounting')->assertOk()->json('summary');
        $this->assertSame($before, $after);
        $this->assertEquals(600, $after['net_profit']);
        $this->assertDatabaseCount('payment_refunds', 1);
    }
}
