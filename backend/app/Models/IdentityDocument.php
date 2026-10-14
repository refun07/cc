<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IdentityDocument extends Model
{
    protected $guarded = [];
    protected $hidden = ['name', 'date_of_birth', 'nid_number', 'image_path'];
    protected function casts(): array
    {
        return ['name'=>'encrypted', 'date_of_birth'=>'encrypted', 'nid_number'=>'encrypted'];
    }
}
