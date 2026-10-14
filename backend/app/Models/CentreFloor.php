<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A bookable floor/hall inside a community centre. Centres may have none
 * (the whole venue is booked as one unit) or many, each with its own
 * capacity and pricing, bookable independently of the others.
 */
class CentreFloor extends Model
{
    protected $guarded = [];

    protected $casts = [
        'capacity' => 'integer',
        'half_day_price' => 'decimal:2',
        'full_day_price' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class, 'centre_id');
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class, 'centre_floor_id');
    }
}
