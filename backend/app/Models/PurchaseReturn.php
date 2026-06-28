<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class PurchaseReturn extends Model { protected $guarded=[]; protected $casts=['return_date'=>'date:Y-m-d']; public function supplier(){return $this->belongsTo(InventorySupplier::class,'supplier_id');} public function purchaseOrder(){return $this->belongsTo(PurchaseOrder::class);} public function items(){return $this->hasMany(PurchaseReturnItem::class);} }
