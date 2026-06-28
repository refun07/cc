<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class InventoryLot extends Model { protected $guarded = []; protected $casts=['manufactured_at'=>'date:Y-m-d','expires_at'=>'date:Y-m-d']; public function item(){return $this->belongsTo(InventoryItem::class,'inventory_item_id');} public function supplier(){return $this->belongsTo(InventorySupplier::class,'supplier_id');} }
