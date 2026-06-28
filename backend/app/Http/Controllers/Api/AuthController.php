<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    /** Register a customer account using their mobile number. */
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', 'unique:users,phone'],
            'email' => ['nullable', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:6'],
        ], [
            'phone.regex' => 'Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX).',
            'phone.unique' => 'An account already exists with this mobile number. Please sign in.',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'password' => Hash::make($data['password']),
            'role' => 'customer',
            'status' => 'active',
            'api_token' => Str::random(72),
        ]);

        return response()->json($this->payload($user), 201);
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
        ];
    }
}
