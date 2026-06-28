<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryStockCount extends Model
{
    protected $guarded = [];
    protected $casts = ['count_date' => 'date:Y-m-d', 'posted_at' => 'datetime'];

    public function lines() { return $this->hasMany(InventoryStockCountLine::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function poster() { return $this->belongsTo(User::class, 'posted_by'); }
}
