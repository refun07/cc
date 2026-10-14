<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PhoneOtpAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.bulksmsbd.api_key', 'test-key');
        config()->set('services.bulksmsbd.sender_id', 'test-sender');
    }

    public function test_registration_requires_a_sent_code_and_consumes_it(): void
    {
        $this->fakeSuccess();
        $payload = ['name' => 'Customer', 'phone' => '01712345678', 'password' => 'secret123'];

        $this->postJson('/api/auth/register', $payload + ['code' => '123456'])->assertUnprocessable();
        $this->assertDatabaseMissing('users', ['phone' => $payload['phone']]);

        $this->postJson('/api/auth/register/otp', ['phone' => $payload['phone']])->assertOk();
        $this->postJson('/api/auth/register/otp', ['phone' => $payload['phone']])->assertStatus(429);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request['number'] === '8801712345678' && $request['senderid'] === 'test-sender');

        $code = $this->sentCode();
        Http::assertSent(fn ($request) => $request['message'] === "Your ICCMS OTP is {$code}");
        $this->postJson('/api/auth/register', $payload + ['code' => '000000'])->assertUnprocessable();
        $this->postJson('/api/auth/register', $payload + ['code' => $code])->assertCreated()->assertJsonPath('user.phone', $payload['phone']);
        $this->postJson('/api/auth/register', $payload + ['code' => $code])->assertUnprocessable();
        $this->assertDatabaseHas('users', ['phone' => $payload['phone'], 'email' => null]);
        $this->assertDatabaseMissing('phone_otps', ['phone' => $payload['phone']]);
    }

    public function test_reset_rejects_expired_or_reused_codes_and_revokes_token(): void
    {
        $this->fakeSuccess();
        $user = User::factory()->create(['phone' => '01712345678', 'api_token' => 'old-token']);

        $this->postJson('/api/auth/password/otp', ['phone' => $user->phone])->assertOk();
        $code = $this->sentCode();
        Http::assertSent(fn ($request) => $request['message'] === "Your ICCMS OTP is {$code}");
        $payload = ['phone' => $user->phone, 'code' => $code, 'password' => 'newsecret123', 'password_confirmation' => 'newsecret123'];

        $this->travel(6)->minutes();
        $this->postJson('/api/auth/password/reset', $payload)->assertUnprocessable();
        $this->travelBack();

        $this->postJson('/api/auth/password/reset', $payload)->assertOk();
        $this->assertTrue(Hash::check('newsecret123', $user->fresh()->password));
        $this->assertNull($user->fresh()->api_token);
        $this->postJson('/api/auth/password/reset', $payload)->assertUnprocessable();
    }

    public function test_unknown_reset_phone_gets_generic_response_and_no_sms(): void
    {
        $this->postJson('/api/auth/password/otp', ['phone' => '01712345678'])
            ->assertOk()->assertJsonPath('message', 'If this number has an account, a code has been sent.');

        Http::assertNothingSent();
    }

    public function test_gateway_failure_never_creates_a_usable_code(): void
    {
        Http::fake(['bulksmsbd.net/*' => Http::response(['response_code' => 1007])]);

        $this->postJson('/api/auth/register/otp', ['phone' => '01712345678'])->assertStatus(503);
        $this->assertDatabaseCount('phone_otps', 0);
    }

    public function test_five_wrong_codes_lock_the_current_otp(): void
    {
        $this->fakeSuccess();
        $this->postJson('/api/auth/register/otp', ['phone' => '01712345678'])->assertOk();
        $correct = $this->sentCode();
        $wrong = $correct === '000000' ? '111111' : '000000';
        $payload = ['name' => 'Customer', 'phone' => '01712345678', 'password' => 'secret123'];

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/auth/register', $payload + ['code' => $wrong])->assertUnprocessable();
        }

        $this->postJson('/api/auth/register', $payload + ['code' => $correct])->assertUnprocessable();
        $this->assertDatabaseMissing('users', ['phone' => '01712345678']);
    }

    public function test_changing_a_profile_phone_requires_a_code_sent_to_the_new_number(): void
    {
        $this->fakeSuccess();
        $user = User::factory()->create(['phone' => '01712345678', 'api_token' => 'profile-token']);
        $this->withToken('profile-token');

        $this->patchJson('/api/auth/profile', ['name' => $user->name, 'phone' => '01812345678'])->assertUnprocessable();
        $this->postJson('/api/auth/profile/phone/otp', ['phone' => '01812345678'])->assertOk();
        $code = $this->sentCode();
        Http::assertSent(fn ($request) => $request['message'] === "Your ICCMS OTP is {$code}");
        $this->patchJson('/api/auth/profile', ['name' => $user->name, 'phone' => '01812345678', 'code' => $code])->assertOk();
        $this->assertSame('01812345678', $user->fresh()->phone);
        $this->patchJson('/api/auth/profile', ['name' => $user->name, 'phone' => '01912345678', 'code' => $code])->assertUnprocessable();
    }

    private function sentCode(): string
    {
        $message = Http::recorded()->last()[0]['message'];
        preg_match('/\b\d{6}\b/', $message, $matches);

        return $matches[0];
    }

    private function fakeSuccess(): void
    {
        Http::fake(['bulksmsbd.net/*' => Http::response(['response_code' => 202])]);
    }
}
