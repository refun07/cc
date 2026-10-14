<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IdentityDocument;
use App\Models\User;
use App\Rules\PlausibleNid;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class IdentityDocumentController extends Controller
{
    private function authorizeUser(Request $request, User $user): void
    {
        abort_unless($request->user()->id === $user->id || $request->user()->role === 'admin', 403);
    }

    private function payload(IdentityDocument $document): array
    {
        return ['name'=>$document->name, 'date_of_birth'=>$document->date_of_birth, 'nid_number'=>$document->nid_number, 'saved_at'=>$document->created_at->toIso8601String()];
    }

    public function show(Request $request, User $user)
    {
        $this->authorizeUser($request, $user);
        $document = IdentityDocument::where('user_id', $user->id)->first();
        return response()->json(['data'=>$document ? $this->payload($document) : null])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, User $user)
    {
        $this->authorizeUser($request, $user);
        $data = $request->validate([
            'image'=>['required','file','image','mimes:jpg,jpeg,png,webp','max:6144','dimensions:max_width=6000,max_height=6000'],
            'name'=>['required','string','max:255'],
            'date_of_birth'=>['required','date_format:Y-m-d','before:today','after:1900-01-01'],
            'nid_number'=>['required',new PlausibleNid],
            'confirmed'=>['required','accepted'],
        ]);
        $path = null;
        try {
            $document = DB::transaction(function () use ($user, $request, $data, &$path) {
                $locked = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
                abort_if(IdentityDocument::where('user_id',$locked->id)->exists(), 409, 'An NID image is already retained for this profile.');
                $path = 'identity-documents/'.Str::uuid().'.enc';
                $image = $request->file('image');
                if (!Storage::disk('local')->put($path, Crypt::encryptString(base64_encode($image->getContent())))) {
                    throw new \RuntimeException('Private image storage failed');
                }
                $document = IdentityDocument::create([
                    'user_id'=>$locked->id, 'recorded_by'=>$request->user()->id,
                    'name'=>$data['name'], 'date_of_birth'=>$data['date_of_birth'], 'nid_number'=>$data['nid_number'],
                    'image_path'=>$path, 'image_mime'=>$image->getMimeType(),
                ]);
                $locked->update(['name'=>$data['name'], 'nid_number'=>$data['nid_number']]);
                return $document;
            });
        } catch (\Throwable $error) {
            if ($path) Storage::disk('local')->delete($path);
            throw $error;
        }
        return response()->json(['data'=>$this->payload($document)],201)->header('Cache-Control','private, no-store');
    }

    public function image(Request $request, User $user)
    {
        $this->authorizeUser($request, $user);
        $document = IdentityDocument::where('user_id',$user->id)->firstOrFail();
        $bytes = base64_decode(Crypt::decryptString(Storage::disk('local')->get($document->image_path)), true);
        return response($bytes)->header('Content-Type',$document->image_mime)
            ->header('Cache-Control','private, no-store')->header('X-Content-Type-Options','nosniff');
    }
}
