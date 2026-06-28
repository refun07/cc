<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppNotification extends Model
{
    protected $table = 'app_notifications';
    protected $guarded = [];
    protected $casts = ['read_at' => 'datetime'];
}
