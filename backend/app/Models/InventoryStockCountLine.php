<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryStockCountLine extends Model
{
    protected $guarded = [];

    public function count() { return $this->belongsTo(InventoryStockCount::class, 'inventory_stock_count_id'); }
    public function item() { return $this->belongsTo(InventoryItem::class, 'inventory_item_id'); }
    public function lot() { return $this->belongsTo(InventoryLot::class, 'inventory_lot_id'); }
}
