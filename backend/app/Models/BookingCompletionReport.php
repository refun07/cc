<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingCompletionReport extends Model
{
    protected $guarded = [];

    protected $casts = ['reported_at' => 'datetime'];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class);
    }

    public function caretaker()
    {
        return $this->belongsTo(User::class, 'caretaker_id');
    }
}
