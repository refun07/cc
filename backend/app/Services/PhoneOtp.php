<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Carbon;

class PhoneOtp
{
    public function issue(string $phone, string $purpose): string
    {
        $previous = DB::table('phone_otps')->where('phone', $phone)->where('purpose', $purpose)->first();

        if ($previous && Carbon::parse($previous->created_at)->greaterThan(now()->subMinute())) {
            return 'cooldown';
        }

        $code = (string) random_int(100000, 999999);

        if (! app(BulkSmsBd::class)->sendOtp($phone, $code)) {
            return 'failed';
        }

        DB::table('phone_otps')->updateOrInsert(
            ['phone' => $phone, 'purpose' => $purpose],
            [
                'code_hash' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(5),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return 'sent';
    }

    // Call inside a transaction; the row lock makes verification single-use.
    public function consume(string $phone, string $purpose, string $code): bool
    {
        $query = DB::table('phone_otps')->where('phone', $phone)->where('purpose', $purpose);
        $otp = $query->lockForUpdate()->first();

        if (! $otp || now()->greaterThan($otp->expires_at) || $otp->attempts >= 5) {
            return false;
        }

        if (! Hash::check($code, $otp->code_hash)) {
            $query->update(['attempts' => $otp->attempts + 1, 'updated_at' => now()]);
            return false;
        }

        $query->delete();
        return true;
    }
}
