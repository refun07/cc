<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\GuideContent;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class GuideController extends Controller
{
    public function index()
    {
        return response()->json(['data' => array_map(fn ($guide) => array_diff_key($guide, array_flip(['body', 'body_bn'])), GuideContent::published())]);
    }

    public function show(string $slug)
    {
        foreach (GuideContent::published() as $guide) {
            if ($guide['slug'] === $slug) {
                return response()->json(['data' => $guide]);
            }
        }

        abort(404);
    }

    public function adminIndex()
    {
        return response()->json(['data' => GuideContent::all()]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'guides' => ['present', 'array', 'max:20'],
            'guides.*.slug' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'distinct'],
            'guides.*.title' => ['required', 'string', 'max:160'],
            'guides.*.title_bn' => ['nullable', 'string', 'max:160'],
            'guides.*.summary' => ['required', 'string', 'max:300'],
            'guides.*.summary_bn' => ['nullable', 'string', 'max:300'],
            'guides.*.body' => ['required', 'string', 'max:12000'],
            'guides.*.body_bn' => ['nullable', 'string', 'max:12000'],
            'guides.*.video_url' => ['nullable', 'url', 'max:500', function ($attribute, $value, $fail) {
                if (! GuideContent::youtubeId($value)) {
                    $fail('Use a valid HTTPS YouTube video URL.');
                }
            }],
            'guides.*.published' => ['required', 'boolean'],
        ]);

        $errors = [];
        foreach ($data['guides'] as $index => $guide) {
            if (! $guide['published']) {
                continue;
            }
            foreach (['title_bn', 'summary_bn', 'body_bn'] as $field) {
                if (blank($guide[$field] ?? null)) {
                    $errors["guides.$index.$field"] = 'Bangla content is required before publishing.';
                }
            }
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return response()->json(['data' => GuideContent::put($data['guides'])]);
    }
}
