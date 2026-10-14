<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SoftwareFeedback extends Model
{
    protected $table = 'software_feedback';

    protected $guarded = [];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
