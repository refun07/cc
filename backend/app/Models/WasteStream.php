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
        'pickup_delay_alerted_at' => 'datetime',
    ];

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class, 'centre_id');
    }

    public function partner()
    {
        return $this->belongsTo(User::class, 'assigned_partner_id');
    }

    public function requester() { return $this->belongsTo(User::class, 'requested_by'); }
    public function assigner() { return $this->belongsTo(User::class, 'assigned_by'); }
    public function collectionConfirmer() { return $this->belongsTo(User::class, 'collection_confirmed_by'); }
}
