<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceTicket extends Model
{
    protected $guarded = [];

    protected $casts = [
        'first_responded_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class, 'centre_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function actions()
    {
        return $this->hasMany(ServiceTicketAction::class)->orderBy('created_at')->orderBy('id');
    }
}
