<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\PhoneOtp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function requestRegistrationOtp(Request $request, PhoneOtp $otp)
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', 'unique:users,phone'],
        ]);

        return $this->otpResponse($otp->issue($data['phone'], 'register'));
    }

    /** Register a customer account using their mobile number. */
    public function register(Request $request, PhoneOtp $otp)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', 'unique:users,phone'],
            'password' => ['required', 'string', 'min:6'],
            'code' => ['required', 'digits:6'],
        ], [
            'phone.regex' => 'Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX).',
            'phone.unique' => 'An account already exists with this mobile number. Please sign in.',
        ]);

        $user = DB::transaction(function () use ($data, $otp) {
            if (! $otp->consume($data['phone'], 'register', $data['code'])) {
                return null;
            }

            return User::create([
                'name' => $data['name'],
                'phone' => $data['phone'],
                'password' => Hash::make($data['password']),
                'role' => 'customer',
                'status' => 'active',
                'api_token' => Str::random(72),
            ]);
        });

        if (! $user) {
            return response()->json(['message' => 'Invalid or expired verification code.'], 422);
        }

        return response()->json($this->payload($user), 201);
    }

    public function requestPasswordResetOtp(Request $request, PhoneOtp $otp)
    {
        $data = $request->validate(['phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/']]);

        if (User::where('phone', $data['phone'])->count() === 1) {
            $result = $otp->issue($data['phone'], 'reset');
            if ($result === 'failed') {
                return response()->json(['message' => 'SMS is unavailable. Please try again later.'], 503);
            }
        }

        return response()->json(['message' => 'If this number has an account, a code has been sent.']);
    }

    public function resetPassword(Request $request, PhoneOtp $otp)
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $updated = DB::transaction(function () use ($data, $otp) {
            if (! $otp->consume($data['phone'], 'reset', $data['code'])) {
                return false;
            }

            $users = User::where('phone', $data['phone'])->limit(2)->get();
            if ($users->count() !== 1) {
                return false;
            }

            return $users->first()->update([
                'password' => Hash::make($data['password']),
                'api_token' => null,
            ]);
        });

        if (! $updated) {
            return response()->json(['message' => 'Invalid or expired verification code.'], 422);
        }

        return response()->json(['message' => 'Password updated. Sign in with your new password.']);
    }

    private function otpResponse(string $result)
    {
        return match ($result) {
            'sent' => response()->json(['message' => 'A verification code has been sent by SMS.']),
            'cooldown' => response()->json(['message' => 'Please wait a minute before requesting another code.'], 429),
            default => response()->json(['message' => 'SMS is unavailable. Please try again later.'], 503),
        };
    }

    /** Sign in with mobile number + password. */
    public function login(Request $request)
    {
        $data = $request->validate([
            'phone' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('phone', $data['phone'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Incorrect mobile number or password.'], 422);
        }
        if ($user->status !== 'active') {
            return response()->json(['message' => 'This account is not active.'], 403);
        }

        // Refresh token on each login.
        $user->update(['api_token' => Str::random(72)]);

        return response()->json($this->payload($user));
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $this->user($request->user())]);
    }

    public function logout(Request $request)
    {
        $request->user()->update(['api_token' => null]);

        return response()->json(['message' => 'Signed out.']);
    }

    public function requestProfilePhoneOtp(Request $request, PhoneOtp $otp)
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', Rule::unique('users', 'phone')->ignore($request->user()->id)],
        ]);

        if ($data['phone'] === $request->user()->phone) {
            return response()->json(['message' => 'Enter a different mobile number.'], 422);
        }

        return $this->otpResponse($otp->issue($data['phone'], 'change'));
    }

    /** Update the signed-in account's own profile. */
    public function updateProfile(Request $request, PhoneOtp $otp)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', Rule::unique('users', 'phone')->ignore($user->id)],
            'code' => ['nullable', 'digits:6'],
        ], [
            'phone.regex' => 'Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX).',
            'phone.unique' => 'Another account already uses this mobile number.',
        ]);

        if ($data['phone'] !== $user->phone) {
            $updated = isset($data['code']) && DB::transaction(function () use ($data, $otp, $user) {
                if (! $otp->consume($data['phone'], 'change', $data['code'])) {
                    return false;
                }

                $user->update(['name' => $data['name'], 'phone' => $data['phone']]);
                return true;
            });

            if (! $updated) {
                return response()->json(['message' => 'Verify the new mobile number with a valid SMS code.'], 422);
            }
        } else {
            $user->update(['name' => $data['name']]);
        }

        return response()->json(['user' => $this->user($user->fresh())]);
    }

    /** Change the signed-in account's password. */
    public function changePassword(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['message' => 'Your current password is incorrect.'], 422);
        }

        $user->update(['password' => Hash::make($data['password'])]);

        return response()->json(['message' => 'Password updated.']);
    }

    protected function payload(User $user): array
    {
        return ['user' => $this->user($user), 'token' => $user->api_token];
    }

    protected function user(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'phone' => $user->phone,
            'email' => $user->email,
            'role' => $user->role,
            'nid_saved' => \App\Rules\PlausibleNid::accepts($user->nid_number),
            'area_scope' => $user->role === 'area_admin' ? $user->area_scope : null,
            'coordinator_permissions' => in_array($user->role, ['project_coordinator', 'caretaker']) ? ($user->coordinator_permissions ?? []) : [],
            'caretaker_centre_id' => $user->role === 'caretaker' ? $user->caretaker_centre_id : null,
        ];
    }
}
