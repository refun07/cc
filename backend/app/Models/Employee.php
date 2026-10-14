<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    protected $guarded = [];

    protected $casts = [
        'documents' => 'array',
        'date_of_birth' => 'date:Y-m-d',
    ];

    public function centre()
    {
        return $this->belongsTo(CommunityCentre::class, 'centre_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
