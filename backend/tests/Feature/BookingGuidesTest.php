<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\GuideContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BookingGuidesTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_guides_are_published_only_and_admin_can_manage_them(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'api_token' => Str::random(72)]);
        $owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);

        $this->getJson('/api/guides')->assertOk()
            ->assertJsonPath('data.0.slug', 'find-a-centre')
            ->assertJsonMissingPath('data.0.body');
        $this->getJson('/api/guides/find-a-centre')->assertOk()
            ->assertJsonPath('data.title_bn', 'পছন্দের সেন্টার খুঁজুন');
        $this->withToken($owner->api_token)->getJson('/api/admin/guides')->assertForbidden();

        $guide = GuideContent::defaults()[0];
        $guide['video_url'] = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        $draft = GuideContent::defaults()[1];
        $draft['published'] = false;
        $payload = ['guides' => [$guide, $draft]];

        $this->withToken($owner->api_token)->putJson('/api/admin/guides', $payload)->assertForbidden();
        $this->withToken($admin->api_token)->putJson('/api/admin/guides', $payload)
            ->assertOk()->assertJsonPath('data.0.video_url', $guide['video_url']);
        $this->getJson('/api/guides')->assertJsonCount(1, 'data');
        $this->getJson('/api/guides/create-account')->assertNotFound();
        $this->withToken($admin->api_token)->getJson('/api/admin/guides')->assertJsonCount(2, 'data');

        $missingBangla = $payload;
        $missingBangla['guides'][0]['title_bn'] = '';
        $missingBangla['guides'][0]['summary_bn'] = '';
        $missingBangla['guides'][0]['body_bn'] = '';
        $this->withToken($admin->api_token)->putJson('/api/admin/guides', $missingBangla)
            ->assertUnprocessable()->assertJsonValidationErrors([
                'guides.0.title_bn', 'guides.0.summary_bn', 'guides.0.body_bn',
            ]);
        $missingBangla['guides'][0]['published'] = false;
        $this->withToken($admin->api_token)->putJson('/api/admin/guides', $missingBangla)->assertOk();
        $this->getJson('/api/guides')->assertJsonPath('data', []);
        $this->withToken($admin->api_token)->putJson('/api/admin/guides', $payload)->assertOk();

        $payload['guides'][0]['video_url'] = 'https://not-youtube.example/watch?v=dQw4w9WgXcQ';
        $this->withToken($admin->api_token)->putJson('/api/admin/guides', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors(['guides.0.video_url']);
        $payload['guides'][0]['video_url'] = 'javascript:alert(1)';
        $this->withToken($admin->api_token)->putJson('/api/admin/guides', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors(['guides.0.video_url']);
        $payload['guides'][0]['video_url'] = null;
        $payload['guides'][1]['slug'] = $guide['slug'];
        $this->withToken($admin->api_token)->putJson('/api/admin/guides', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors(['guides.0.slug', 'guides.1.slug']);

        $this->withToken($admin->api_token)->putJson('/api/admin/guides', ['guides' => []])->assertOk();
        $this->getJson('/api/guides')->assertJsonPath('data', []);
    }

    public function test_youtube_url_parser_accepts_only_video_urls(): void
    {
        $this->assertSame('dQw4w9WgXcQ', GuideContent::youtubeId('https://youtu.be/dQw4w9WgXcQ'));
        $this->assertSame('dQw4w9WgXcQ', GuideContent::youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'));
        $this->assertNull(GuideContent::youtubeId('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'));
        $this->assertNull(GuideContent::youtubeId('http://youtube.com/watch?v=dQw4w9WgXcQ'));
    }
}
