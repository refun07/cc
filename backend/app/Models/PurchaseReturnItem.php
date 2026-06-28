<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class PurchaseReturnItem extends Model { protected $guarded=[]; public function item(){return $this->belongsTo(InventoryItem::class,'inventory_item_id');} public function lot(){return $this->belongsTo(InventoryLot::class,'inventory_lot_id');} }
