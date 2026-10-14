<?php

namespace Tests\Feature;

use App\Models\{Booking, CommunityCentre, PaymentReceipt, Settlement, User};
use App\Services\{BookingService, SettlementService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CentreCashSettlementTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $centre = CommunityCentre::create(['owner_id' => $owner->id, 'name' => 'Cash QA', 'slug' => Str::random(12), 'area' => 'QA', 'capacity' => 100, 'base_price' => 880, 'status' => 'active']);
        $booking = Booking::create(['booking_no' => Str::random(12), 'centre_id' => $centre->id, 'customer_name' => 'QA', 'customer_phone' => '01911111111', 'event_date' => '2027-01-01', 'session_type' => 'full_day', 'total_amount' => 1000, 'service_charge' => 50, 'vat_amount' => 70, 'advance_amount' => 300, 'paid_amount' => 0, 'due_amount' => 1000, 'status' => 'payment_pending']);
        return [$admin, $owner, $centre, $booking];
    }

    private function payload($centre): array
    {
        return ['centre_id' => $centre->id, 'period_start' => now()->toDateString(), 'period_end' => now()->toDateString()];
    }

    public function test_cash_only_has_no_payout_even_with_positive_adjustment_and_still_appears_in_reports(): void
    {
        [$admin, $owner, $centre, $booking] = $this->fixture();
        app(BookingService::class)->applyPayment($booking, 'Cash', 'full');
        app(BookingService::class)->refund($booking->fresh(), 200);
        $before = $booking->fresh()->getRawOriginal();
        $this->withToken($admin->api_token)->postJson('/api/admin/settlements', $this->payload($centre) + ['adjustment_amount' => 1000])->assertUnprocessable();
        $this->assertDatabaseCount('settlements', 0);
        $this->assertDatabaseCount('settlement_items', 0);
        $this->assertSame($before, $booking->fresh()->getRawOriginal());
        $this->withToken($admin->api_token)->getJson('/api/admin/settlements')->assertOk()->assertJsonPath('summary.payable', 0)->assertJsonPath('centre_cash.net_collected', 800)->assertJsonPath('centre_cash.fees_tax_to_reconcile', 96);
        $this->withToken($owner->api_token)->getJson('/api/owner/accounting')->assertOk()->assertJsonPath('summary.settlement_payable', 0)->assertJsonPath('centre_cash.net_collected', 800);
        $this->withToken($admin->api_token)->getJson('/api/admin/payments')->assertOk()->assertJsonPath('totals.amount', 1000);
    }

    public function test_mixed_installments_use_receipt_method_not_last_aggregate_method_and_reserve_once(): void
    {
        [$admin, , $centre, $booking] = $this->fixture();
        $service = app(BookingService::class);
        $service->applyPayment($booking, 'Bank Transfer', 'custom', 400);
        $bank = PaymentReceipt::first();
        $service->applyPayment($booking->fresh(), 'Cash', 'custom', 600);
        $result = $this->withToken($admin->api_token)->postJson('/api/admin/settlements', $this->payload($centre))->assertCreated()
            ->assertJsonPath('data.gross_amount', 400)->assertJsonPath('data.net_amount', 352)->assertJsonPath('data.tax_amount', 28)->assertJsonPath('data.commission_amount', 20)->assertJsonCount(1, 'data.items');
        $this->assertEquals($bank->id, $result->json('data.items.0.payment_receipt_id'));
        $this->withToken($admin->api_token)->postJson('/api/admin/settlements', $this->payload($centre))->assertUnprocessable();
        $id = $result->json('data.id');
        $this->withToken($admin->api_token)->patchJson("/api/admin/settlements/$id", ['status' => 'approved'])->assertOk();
        $this->withToken($admin->api_token)->patchJson("/api/admin/settlements/$id", ['status' => 'paid', 'payment_reference' => 'TEST-ONLY'])->assertOk();
    }

    public function test_cash_first_then_bank_does_not_leak_cash_into_payout(): void
    {
        [$admin, , $centre, $booking] = $this->fixture();
        app(BookingService::class)->applyPayment($booking, 'Cash', 'custom', 400);
        app(BookingService::class)->applyPayment($booking->fresh(), 'Bank Transfer', 'custom', 600);
        $this->withToken($admin->api_token)->postJson('/api/admin/settlements', $this->payload($centre))->assertCreated()->assertJsonPath('data.gross_amount', 600)->assertJsonPath('data.net_amount', 528);
    }

    public function test_old_cash_settlements_cannot_be_approved_or_paid_and_history_is_unchanged(): void
    {
        foreach ([false, true] as $linked) {
            [$admin, $owner, $centre, $booking] = $this->fixture();
            app(BookingService::class)->applyPayment($booking, 'Cash', 'full');
            $receipt = PaymentReceipt::where('booking_id', $booking->id)->first();
            $receipt->update(['payment_method' => ' cash ']);
            $settlement = Settlement::create(['settlement_no' => Str::random(12), 'centre_id' => $centre->id, 'period_start' => now(), 'period_end' => now(), 'status' => 'approved', 'gross_amount' => 1000, 'net_amount' => 880]);
            $settlement->items()->create(['booking_id' => $booking->id, 'payment_receipt_id' => $linked ? $receipt->id : null, 'gross_amount' => 1000, 'commission_amount' => 50, 'tax_amount' => 70, 'net_amount' => 880]);
            $before = $settlement->fresh()->getRawOriginal();
            $this->withToken($admin->api_token)->patchJson('/api/admin/settlements/'.$settlement->id, ['status' => 'paid', 'payment_reference' => 'DUPLICATE'])->assertUnprocessable();
            $this->assertSame($before, $settlement->fresh()->getRawOriginal());
            $this->withToken($admin->api_token)->getJson('/api/admin/settlements')->assertOk()->assertJsonPath('summary.payable', 0);
            $this->withToken($owner->api_token)->getJson('/api/owner/accounting')->assertOk()->assertJsonPath('summary.settlement_payable', 0)->assertJsonPath('settlements.0.contains_centre_cash', true);
            $this->withToken($admin->api_token)->patchJson('/api/admin/settlements/'.$settlement->id, ['status' => 'held'])->assertOk();
            $this->withToken($admin->api_token)->patchJson('/api/admin/settlements/'.$settlement->id, ['status' => 'approved'])->assertUnprocessable();
        }
    }
}
