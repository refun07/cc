<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentReceipt extends Model
{
    protected $guarded = [];

    protected $casts = ['paid_at' => 'datetime'];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
