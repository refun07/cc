<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceTicketAction extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['created_at' => 'datetime'];

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
