<?php

namespace App\Services;

use App\Models\AppNotification;

class Notify
{
    /** Create a notification for a user (no-op if no user id). */
    public static function send(?int $userId, string $title, string $body = '', string $type = 'info', ?string $link = null): void
    {
        if (! $userId) {
            return;
        }
        AppNotification::create([
            'user_id' => $userId,
            'title' => $title,
            'body' => $body,
            'type' => $type,
            'link' => $link,
        ]);
    }

    /** Notify every admin. */
    public static function admins(string $title, string $body = '', string $type = 'info', ?string $link = null): void
    {
        \App\Models\User::where('role', 'admin')->pluck('id')
            ->each(fn ($id) => self::send($id, $title, $body, $type, $link));
    }
}
