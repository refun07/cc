<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryItem extends Model
{
    protected $guarded = [];

    protected $casts = [
        'track_lots' => 'boolean',
        'current_stock' => 'float',
        'minimum_stock' => 'float',
        'purchase_price' => 'float',
        'average_cost' => 'float',
    ];
    public function lots() { return $this->hasMany(InventoryLot::class); }
    public function movements() { return $this->hasMany(StockMovement::class); }
    public function stockCountLines() { return $this->hasMany(InventoryStockCountLine::class); }
}
