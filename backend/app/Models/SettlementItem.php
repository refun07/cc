<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SettlementItem extends Model
{
    protected $guarded = [];

    public function settlement()
    {
        return $this->belongsTo(Settlement::class);
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
