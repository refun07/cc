<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class PurchaseOrder extends Model { protected $guarded = []; protected $casts = ['order_date'=>'date:Y-m-d','expected_date'=>'date:Y-m-d','ordered_at'=>'datetime','received_at'=>'datetime']; public function supplier(){return $this->belongsTo(InventorySupplier::class,'supplier_id');} public function items(){return $this->hasMany(PurchaseOrderItem::class);} public function returns(){return $this->hasMany(PurchaseReturn::class);} }
