<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class InventorySupplier extends Model { protected $guarded = []; public function purchaseOrders() { return $this->hasMany(PurchaseOrder::class, 'supplier_id'); } }
