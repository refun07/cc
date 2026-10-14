<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;

class AuthenticateToken
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        $user = $token ? User::where('api_token', $token)->first() : null;

        if (! $user) {
            return response()->json(['message' => 'Please sign in to continue.'], 401);
        }
        if ($user->status !== 'active') {
            return response()->json(['message' => 'This account is not active.'], 403);
        }

        // Make the user available via $request->user() and auth()->user().
        $request->setUserResolver(fn () => $user);
        auth()->setUser($user);

        return $next($request);
    }
}
