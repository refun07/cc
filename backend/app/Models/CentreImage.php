<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CentreImage extends Model
{
    protected $guarded = [];

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class, 'centre_id');
    }
}
