<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SettlementItem extends Model
{
    protected $guarded = [];

    public function receipt()
    {
        return $this->belongsTo(PaymentReceipt::class, 'payment_receipt_id');
    }

    public function scopeCentreCash($query)
    {
        return $query->where(function ($q) {
            $q->whereHas('receipt', fn ($r) => $r->whereRaw("LOWER(TRIM(payment_method)) = 'cash'"))
                ->orWhere(function ($legacy) {
                    $legacy->whereNull('payment_receipt_id')->whereHas('booking', function ($booking) {
                        $booking->whereHas('payment', fn ($p) => $p->whereRaw("LOWER(TRIM(payment_method)) = 'cash'"))
                            ->orWhereIn('id', PaymentReceipt::whereRaw("LOWER(TRIM(payment_method)) = 'cash'")->select('booking_id'));
                    });
                });
        });
    }

    public function settlement()
    {
        return $this->belongsTo(Settlement::class);
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
