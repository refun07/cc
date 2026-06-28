<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class PurchaseOrderItem extends Model { protected $guarded = []; public function purchaseOrder(){return $this->belongsTo(PurchaseOrder::class);} public function item(){return $this->belongsTo(InventoryItem::class,'inventory_item_id');} public function lots(){return $this->hasMany(InventoryLot::class);} }
