<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class InventoryWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private CommunityCentre $centre;
    private InventoryItem $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $this->centre = CommunityCentre::create([
            'owner_id'=>$this->owner->id,'name'=>'Inventory Centre','slug'=>'inventory-centre','area'=>'Wari',
            'capacity'=>300,'base_price'=>30000,'half_day_price'=>30000,'full_day_price'=>50000,'status'=>'active',
        ]);
        $this->item = InventoryItem::create([
            'centre_id'=>$this->centre->id,'name'=>'Dinner Plate','category'=>'Kitchen','sku'=>'PLATE-01',
            'unit'=>'pcs','current_stock'=>0,'minimum_stock'=>5,'purchase_price'=>0,'average_cost'=>0,'track_lots'=>true,'status'=>'active',
        ]);
    }

    public function test_purchase_receive_return_and_damage_keep_stock_and_lots_consistent(): void
    {
        $supplierId = $this->withToken($this->owner->api_token)->postJson('/api/owner/inventory-system/suppliers', [
            'name'=>'Tableware Supply Co','contact_person'=>'Rahim','phone'=>'01711111111','payment_terms'=>'30 days','status'=>'active',
        ])->assertCreated()->json('data.id');

        $po = $this->withToken($this->owner->api_token)->postJson('/api/owner/inventory-system/purchase-orders', [
            'supplier_id'=>$supplierId,'order_date'=>now()->toDateString(),'expected_date'=>now()->addDays(3)->toDateString(),
            'lines'=>[['inventory_item_id'=>$this->item->id,'quantity'=>10,'unit_cost'=>100]],
        ])->assertCreated()->assertJsonPath('data.total_amount', 1000)->json('data');

        $this->withToken($this->owner->api_token)->patchJson("/api/owner/inventory-system/purchase-orders/{$po['id']}/status", ['status'=>'ordered'])
            ->assertOk()->assertJsonPath('data.status','ordered');

        $poItemId = $po['items'][0]['id'];
        $this->withToken($this->owner->api_token)->postJson("/api/owner/inventory-system/purchase-orders/{$po['id']}/receive", [
            'lines'=>[['purchase_order_item_id'=>$poItemId,'quantity'=>6,'lot_no'=>'LOT-A','expires_at'=>now()->addYear()->toDateString()]],
        ])->assertOk()->assertJsonPath('data.status','partially_received');

        $this->assertDatabaseHas('inventory_items',['id'=>$this->item->id,'current_stock'=>6,'average_cost'=>100]);
        $lotA = \App\Models\InventoryLot::where('lot_no','LOT-A')->firstOrFail();
        $this->assertSame(6.0,(float)$lotA->available_quantity);

        $this->withToken($this->owner->api_token)->postJson("/api/owner/inventory-system/purchase-orders/{$po['id']}/receive", [
            'lines'=>[['purchase_order_item_id'=>$poItemId,'quantity'=>4,'lot_no'=>'LOT-B','expires_at'=>now()->addMonths(8)->toDateString()]],
        ])->assertOk()->assertJsonPath('data.status','received');
        $lotB = \App\Models\InventoryLot::where('lot_no','LOT-B')->firstOrFail();

        $return = $this->withToken($this->owner->api_token)->postJson("/api/owner/inventory-system/purchase-orders/{$po['id']}/return", [
            'return_date'=>now()->toDateString(),'reason'=>'Chipped on delivery',
            'lines'=>[['purchase_order_item_id'=>$poItemId,'inventory_lot_id'=>$lotA->id,'quantity'=>2]],
        ])->assertCreated()->assertJsonPath('data.total_amount',200)->json('data');

        $this->withToken($this->owner->api_token)->postJson('/api/owner/inventory-system/damages', [
            'inventory_item_id'=>$this->item->id,'inventory_lot_id'=>$lotB->id,
            'quantity'=>1,'reason'=>'Broken during setup',
        ])->assertCreated()->assertJsonPath('data.quantity',1);

        $this->assertDatabaseHas('inventory_items',['id'=>$this->item->id,'current_stock'=>7]);
        $this->assertDatabaseHas('inventory_lots',['id'=>$lotA->id,'available_quantity'=>4]);
        $this->assertDatabaseHas('inventory_lots',['id'=>$lotB->id,'available_quantity'=>3,'damaged_quantity'=>1]);
        $this->assertDatabaseHas('purchase_returns',['id'=>$return['id'],'total_amount'=>200]);
        $this->assertDatabaseCount('stock_movements',4);

        $this->withToken($this->owner->api_token)->getJson('/api/owner/inventory-system')
            ->assertOk()->assertJsonPath('summary.items',1)->assertJsonPath('summary.stock_value',700)
            ->assertJsonCount(2,'lots')->assertJsonCount(1,'returns')->assertJsonCount(1,'damages');
    }

    public function test_inventory_documents_are_scoped_to_the_owning_centre(): void
    {
        $otherOwner=User::factory()->create(['role'=>'owner','api_token'=>Str::random(72)]);
        $this->withToken($otherOwner->api_token)->getJson('/api/owner/inventory-system')->assertOk()->assertJsonPath('summary.items',0);

        $supplierId=$this->withToken($this->owner->api_token)->postJson('/api/owner/inventory-system/suppliers',['name'=>'Scoped Supplier'])->json('data.id');
        $this->withToken($otherOwner->api_token)->deleteJson("/api/owner/inventory-system/suppliers/{$supplierId}")->assertForbidden();
    }

    public function test_opening_stock_creates_a_lot_and_recovered_damage_restores_stock(): void
    {
        $item = $this->withToken($this->owner->api_token)->postJson('/api/owner/inventory', [
            'name'=>'Water Glass','category'=>'Kitchen','sku'=>'GLASS-01','unit'=>'pcs',
            'current_stock'=>5,'minimum_stock'=>2,'purchase_price'=>80,'average_cost'=>80,
            'track_lots'=>true,'condition'=>'good','status'=>'active',
        ])->assertCreated()->json('data');

        $lot = \App\Models\InventoryLot::where('inventory_item_id', $item['id'])->firstOrFail();
        $this->assertSame(5.0, (float) $lot->available_quantity);
        $this->assertDatabaseHas('stock_movements', [
            'inventory_item_id'=>$item['id'],'inventory_lot_id'=>$lot->id,'movement_type'=>'in','quantity'=>5,
        ]);

        $damage = $this->withToken($this->owner->api_token)->postJson('/api/owner/inventory-system/damages', [
            'inventory_item_id'=>$item['id'],'inventory_lot_id'=>$lot->id,
            'quantity'=>2,'reason'=>'Cracked during inspection',
        ])->assertCreated()->assertJsonPath('data.status','recorded')->json('data');

        $this->assertDatabaseHas('inventory_items',['id'=>$item['id'],'current_stock'=>3]);
        $this->assertDatabaseHas('inventory_lots',['id'=>$lot->id,'available_quantity'=>3,'damaged_quantity'=>2]);

        $this->withToken($this->owner->api_token)
            ->patchJson("/api/owner/inventory-system/damages/{$damage['id']}/status", ['status'=>'recovered'])
            ->assertOk()->assertJsonPath('data.status','recovered');

        $this->assertDatabaseHas('inventory_items',['id'=>$item['id'],'current_stock'=>5]);
        $this->assertDatabaseHas('inventory_lots',['id'=>$lot->id,'available_quantity'=>5,'damaged_quantity'=>0]);
        $this->assertDatabaseCount('stock_movements',3);
    }

    public function test_manual_movements_update_the_selected_lot_and_product_together(): void
    {
        $this->withToken($this->owner->api_token)->postJson("/api/owner/inventory/{$this->item->id}/adjust", [
            'movement_type'=>'in','quantity'=>5,'lot_no'=>'MANUAL-01','expires_at'=>now()->addYear()->toDateString(),
            'reason'=>'Emergency local purchase',
        ])->assertOk()->assertJsonPath('item.current_stock',5);

        $lot = \App\Models\InventoryLot::where('lot_no','MANUAL-01')->firstOrFail();
        $this->assertDatabaseHas('inventory_lots',['id'=>$lot->id,'received_quantity'=>5,'available_quantity'=>5]);

        $this->withToken($this->owner->api_token)->postJson("/api/owner/inventory/{$this->item->id}/adjust", [
            'movement_type'=>'out','quantity'=>2,'inventory_lot_id'=>$lot->id,'reason'=>'Issued for event',
        ])->assertOk()->assertJsonPath('item.current_stock',3)->assertJsonPath('data.inventory_lot_id',$lot->id);

        $this->assertDatabaseHas('inventory_lots',['id'=>$lot->id,'available_quantity'=>3]);
        $this->assertDatabaseCount('stock_movements',2);
    }

    public function test_physical_stock_count_posts_variances_to_items_lots_and_ledger(): void
    {
        $item = $this->withToken($this->owner->api_token)->postJson('/api/owner/inventory', [
            'name'=>'Serving Bowl','category'=>'Kitchen','sku'=>'BOWL-01','unit'=>'pcs',
            'current_stock'=>5,'minimum_stock'=>1,'purchase_price'=>120,'average_cost'=>120,
            'track_lots'=>true,'condition'=>'good','status'=>'active',
        ])->assertCreated()->json('data');
        $lot = \App\Models\InventoryLot::where('inventory_item_id',$item['id'])->firstOrFail();

        $count = $this->withToken($this->owner->api_token)->postJson('/api/owner/inventory-system/stock-counts', [
            'count_date'=>now()->toDateString(),'notes'=>'Monthly kitchen count',
        ])->assertCreated()->assertJsonPath('data.status','draft')->json('data');

        $lines = collect($count['lines'])->map(fn ($line) => [
            'id'=>$line['id'],
            'counted_quantity'=>$line['inventory_item_id']===$item['id'] ? 4 : $line['system_quantity'],
        ])->values()->all();

        $this->withToken($this->owner->api_token)
            ->postJson("/api/owner/inventory-system/stock-counts/{$count['id']}/post", ['lines'=>$lines])
            ->assertOk()->assertJsonPath('data.status','posted');

        $this->assertDatabaseHas('inventory_items',['id'=>$item['id'],'current_stock'=>4]);
        $this->assertDatabaseHas('inventory_lots',['id'=>$lot->id,'available_quantity'=>4]);
        $this->assertDatabaseHas('inventory_stock_count_lines',[
            'inventory_stock_count_id'=>$count['id'],'inventory_item_id'=>$item['id'],'counted_quantity'=>4,'variance'=>-1,
        ]);
        $this->assertDatabaseHas('stock_movements',[
            'inventory_item_id'=>$item['id'],'inventory_lot_id'=>$lot->id,'movement_type'=>'adjust',
            'quantity'=>1,'reference_type'=>'stock_count','reference_id'=>$count['id'],
        ]);
    }
}
