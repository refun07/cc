<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

class RouteAuthorizationQaTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_non_parameterized_protected_action_rejects_anonymous_requests(): void
    {
        $checked = 0;
        foreach (Route::getRoutes() as $route) {
            if (!str_starts_with($route->uri(), 'api/') || str_contains($route->uri(), '{') || !in_array('auth.token', $route->gatherMiddleware(), true)) continue;
            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $this->json($method, '/'.$route->uri())->assertUnauthorized();
                $checked++;
            }
        }
        $this->assertGreaterThan(50, $checked);
    }

    public function test_customer_cannot_execute_any_non_parameterized_portal_action(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $this->withToken($user->api_token);
        $checked = 0;
        foreach (Route::getRoutes() as $route) {
            if (!str_starts_with($route->uri(), 'api/') || str_contains($route->uri(), '{')) continue;
            $roles = array_filter($route->gatherMiddleware(), fn ($middleware) => str_starts_with($middleware, 'role:'));
            if (!$roles) continue;
            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $this->json($method, '/'.$route->uri())->assertForbidden();
                $checked++;
            }
        }
        $this->assertGreaterThan(40, $checked);
    }
}
