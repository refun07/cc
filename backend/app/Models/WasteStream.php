<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WasteStream extends Model
{
    protected $guarded = [];

    protected $casts = [
        'quantity' => 'decimal:2',
        'pickup_scheduled_for' => 'datetime',
        'collected_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class, 'centre_id');
    }

    public function partner()
    {
        return $this->belongsTo(User::class, 'assigned_partner_id');
    }
}
