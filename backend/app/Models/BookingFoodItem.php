<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingFoodItem extends Model
{
    protected $guarded = [];

    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }

    public function foodMenu()
    {
        return $this->belongsTo(FoodMenu::class, 'food_menu_id');
    }
}
