<?php

namespace Tests\Feature;

use App\Models\IdentityDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class IdentityDocumentTest extends TestCase
{
    use RefreshDatabase;

    private function account(string $role = 'customer'): User
    {
        return User::factory()->create(['role'=>$role,'status'=>'active','api_token'=>Str::random(72)]);
    }

    private function payload(): array
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=');
        return ['name'=>'TEST PERSON','date_of_birth'=>'1990-02-20','nid_number'=>'5837291640','confirmed'=>true,'image'=>UploadedFile::fake()->createWithContent('nid.png',$png)];
    }

    public function test_admin_upload_is_private_encrypted_and_immutable(): void
    {
        Storage::fake('local');
        $admin=$this->account('admin'); $user=$this->account();
        $url="/api/users/{$user->id}/identity";
        $this->withToken($admin->api_token)->postJson($url,$this->payload())->assertCreated()->assertJsonPath('data.name','TEST PERSON');
        $doc=IdentityDocument::firstOrFail();
        Storage::disk('local')->assertExists($doc->image_path);
        $this->assertNotEquals('TEST PERSON',$doc->getRawOriginal('name'));
        $this->assertNotEquals('5837291640',$doc->getRawOriginal('nid_number'));
        $this->assertStringNotContainsString("\x89PNG",Storage::disk('local')->get($doc->image_path));
        $this->assertEquals('5837291640',$user->fresh()->nid_number);
        $this->withToken($user->api_token)->getJson($url)->assertOk()->assertJsonPath('data.date_of_birth','1990-02-20');
        $this->withToken($user->api_token)->get($url.'/image')->assertOk()->assertHeader('content-type','image/png');
        $this->withToken($admin->api_token)->postJson($url,$this->payload())->assertConflict();
        $this->withToken($user->api_token)->deleteJson($url)->assertStatus(405);
        $this->assertDatabaseCount('identity_documents',1);
        $this->assertCount(1,Storage::disk('local')->allFiles());
    }

    public function test_other_users_and_operational_roles_cannot_access_identity(): void
    {
        $target=$this->account();
        $url="/api/users/{$target->id}/identity";
        $this->getJson($url)->assertUnauthorized();
        foreach (['customer','owner','caretaker','area_admin','waste_partner'] as $role) {
            $actor=$this->account($role);
            $this->withToken($actor->api_token)->getJson($url)->assertForbidden();
            $this->withToken($actor->api_token)->getJson($url.'/image')->assertForbidden();
            $this->withToken($actor->api_token)->postJson($url,$this->payload())->assertForbidden();
        }
    }

    public function test_image_valid_date_and_review_are_required(): void
    {
        Storage::fake('local'); $user=$this->account();
        $url="/api/users/{$user->id}/identity";
        $this->withToken($user->api_token)->postJson($url,['name'=>'A'])->assertUnprocessable()->assertJsonValidationErrors(['image','date_of_birth','nid_number','confirmed']);
        $this->withToken($user->api_token)->postJson($url,array_replace($this->payload(),['image'=>UploadedFile::fake()->create('test.svg',1,'image/svg+xml')]))->assertUnprocessable();
        $this->withToken($user->api_token)->postJson($url,array_replace($this->payload(),['date_of_birth'=>'2090-01-01','nid_number'=>'12345678910','confirmed'=>false]))->assertUnprocessable();
        $this->assertDatabaseCount('identity_documents',0);
        $this->assertCount(0,Storage::disk('local')->allFiles());
    }
}
