<?php

use Illuminate\Support\Facades\Route;

Route::get('/{path?}', function () {
    $index = public_path('app/index.html');

    abort_unless(is_file($index), 503, 'The frontend has not been built.');

    // The shell references content-hashed lazy chunks. It must be revalidated
    // after every deployment so an older shell never requests removed assets.
    return response(file_get_contents($index), 200, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma' => 'no-cache',
        'Expires' => '0',
    ]);
})->where('path', '^(?!api(?:/|$)|up$|storage(?:/|$)).*');
