<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    protected $guarded = [];

    protected $casts = [
        'event_date' => 'date:Y-m-d',
        'cancelled_at' => 'datetime',
        'attachments' => 'array',
    ];

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class, 'centre_id');
    }

    public function floor()
    {
        return $this->belongsTo(CentreFloor::class, 'centre_floor_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function foodItems()
    {
        return $this->hasMany(BookingFoodItem::class, 'booking_id');
    }

    public function bookingDates()
    {
        return $this->hasMany(BookingDate::class)->orderBy('date');
    }

    public function payment()
    {
        return $this->hasOne(Payment::class, 'booking_id');
    }

    public function settlementItem()
    {
        return $this->hasOne(SettlementItem::class);
    }

    public function getRouteKeyName(): string
    {
        return 'booking_no';
    }
}
