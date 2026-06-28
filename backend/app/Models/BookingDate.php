<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingDate extends Model
{
    protected $guarded = [];

    protected $casts = [
        'date' => 'date:Y-m-d',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
