<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Settlement extends Model
{
    protected $guarded = [];

    public function scopeWithCashFlag($query)
    {
        return $query->withExists(['items as contains_centre_cash' => fn ($items) => $items->centreCash()]);
    }

    public function scopeWithoutCentreCash($query)
    {
        return $query->whereDoesntHave('items', fn ($items) => $items->centreCash());
    }

    protected $casts = [
        'period_start' => 'date:Y-m-d',
        'period_end' => 'date:Y-m-d',
        'approved_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class, 'centre_id');
    }

    public function items()
    {
        return $this->hasMany(SettlementItem::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
