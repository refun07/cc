<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommunityCentre;
use App\Models\InventoryDamageReport;
use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\InventoryStockCount;
use App\Models\InventorySupplier;
use App\Models\PurchaseOrder;
use App\Models\PurchaseReturn;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryController extends Controller
{
    public function __construct(protected InventoryService $inventory) {}

    protected function centres(Request $request) { return CommunityCentre::where('owner_id', $request->user()->id); }
    protected function centreIds(Request $request) { return $this->centres($request)->pluck('id'); }
    protected function primaryCentre(Request $request) { return $this->centres($request)->firstOrFail(); }
    protected function own(Request $request, $model) { abort_unless($this->centreIds($request)->contains($model->centre_id), 403, 'Not your inventory record.'); return $model; }

    public function overview(Request $request)
    {
        $ids = $this->centreIds($request);
        InventoryLot::whereIn('centre_id', $ids)->where('status', 'active')->whereNotNull('expires_at')->whereDate('expires_at', '<', now()->toDateString())->update(['status' => 'expired']);
        $items = InventoryItem::whereIn('centre_id', $ids)->latest()->get();
        $lots = InventoryLot::whereIn('centre_id', $ids)->with('item:id,name,sku,unit', 'supplier:id,name')->latest()->get();
        $orders = PurchaseOrder::whereIn('centre_id', $ids)->with('supplier:id,name', 'items.item:id,name,sku,unit')->latest()->get();
        $returns = PurchaseReturn::whereIn('centre_id', $ids)->with('supplier:id,name', 'purchaseOrder:id,po_no', 'items.item:id,name,sku,unit')->latest()->limit(100)->get();
        $damages = InventoryDamageReport::whereIn('centre_id', $ids)->with('item:id,name,sku,unit', 'lot:id,lot_no')->latest()->limit(100)->get();
        $stockCounts = InventoryStockCount::whereIn('centre_id', $ids)->with('lines.item:id,name,sku,unit', 'lines.lot:id,lot_no')->latest()->limit(50)->get();
        $suppliers = InventorySupplier::whereIn('centre_id', $ids)->withCount('purchaseOrders')->latest()->get();

        return response()->json([
            'summary' => [
                'items' => $items->count(),
                'stock_units' => (float) $items->sum('current_stock'),
                'stock_value' => round($items->sum(fn ($item) => (float) $item->current_stock * (float) $item->average_cost), 2),
                'low_stock' => $items->filter(fn ($item) => (float) $item->current_stock <= (float) $item->minimum_stock)->count(),
                'open_pos' => $orders->whereIn('status', ['draft', 'ordered', 'partially_received'])->count(),
                'expiring_lots' => $lots->filter(fn ($lot) => $lot->expires_at && $lot->expires_at->between(now()->startOfDay(), now()->addDays(30)->endOfDay()) && (float) $lot->available_quantity > 0)->count(),
                'damaged_units' => (float) $damages->where('status', 'recorded')->sum('quantity'),
                'open_stock_counts' => $stockCounts->where('status', 'draft')->count(),
            ],
            'items' => $items,
            'suppliers' => $suppliers,
            'purchase_orders' => $orders,
            'lots' => $lots,
            'returns' => $returns,
            'damages' => $damages,
            'stock_counts' => $stockCounts,
        ]);
    }

    public function storeSupplier(Request $request)
    {
        $data = $this->validateSupplier($request); $data['centre_id'] = $this->primaryCentre($request)->id;
        return response()->json(['data' => InventorySupplier::create($data)], 201);
    }
    public function updateSupplier(Request $request, InventorySupplier $supplier)
    {
        $this->own($request, $supplier)->update($this->validateSupplier($request));
        return response()->json(['data' => $supplier]);
    }
    public function deleteSupplier(Request $request, InventorySupplier $supplier)
    {
        $this->own($request, $supplier); abort_if($supplier->purchaseOrders()->exists(), 422, 'Suppliers with purchase orders cannot be removed.'); $supplier->delete();
        return response()->json(['message' => 'Supplier removed.']);
    }
    protected function validateSupplier(Request $request): array
    {
        return $request->validate([
            'name'=>['required','string','max:255'],'contact_person'=>['nullable','string','max:255'],
            'phone'=>['nullable','string','max:30'],'email'=>['nullable','email','max:255'],'address'=>['nullable','string'],
            'tax_id'=>['nullable','string','max:100'],'payment_terms'=>['nullable','string','max:100'],
            'status'=>['nullable','in:active,inactive'],'notes'=>['nullable','string','max:2000'],
        ]);
    }

    public function storePurchaseOrder(Request $request)
    {
        $data = $request->validate([
            'supplier_id'=>['required','integer'],'order_date'=>['required','date'],'expected_date'=>['nullable','date','after_or_equal:order_date'],
            'discount_amount'=>['nullable','numeric','min:0'],'tax_amount'=>['nullable','numeric','min:0'],'notes'=>['nullable','string','max:2000'],
            'lines'=>['required','array','min:1'],'lines.*.inventory_item_id'=>['required','integer','distinct'],
            'lines.*.quantity'=>['required','numeric','gt:0'],'lines.*.unit_cost'=>['required','numeric','min:0'],
        ]);
        $centre = $this->primaryCentre($request);
        $supplier = InventorySupplier::where('centre_id', $centre->id)->findOrFail($data['supplier_id']);
        $itemIds = collect($data['lines'])->pluck('inventory_item_id');
        abort_unless(InventoryItem::where('centre_id', $centre->id)->whereIn('id', $itemIds)->count() === $itemIds->count(), 422, 'One or more products do not belong to this centre.');

        $po = DB::transaction(function () use ($data, $centre, $supplier, $request) {
            $subtotal = collect($data['lines'])->sum(fn ($line) => round((float) $line['quantity'] * (float) $line['unit_cost'], 2));
            $discount = (float) ($data['discount_amount'] ?? 0); $tax = (float) ($data['tax_amount'] ?? 0);
            $po = PurchaseOrder::create([
                'po_no'=>'PO-'.now()->format('ym').'-'.strtoupper(Str::random(6)),'centre_id'=>$centre->id,'supplier_id'=>$supplier->id,
                'order_date'=>$data['order_date'],'expected_date'=>$data['expected_date'] ?? null,'subtotal'=>$subtotal,
                'discount_amount'=>$discount,'tax_amount'=>$tax,'total_amount'=>max(round($subtotal-$discount+$tax,2),0),
                'notes'=>$data['notes'] ?? null,'created_by'=>$request->user()->id,
            ]);
            foreach ($data['lines'] as $line) $po->items()->create([
                'inventory_item_id'=>$line['inventory_item_id'],'ordered_quantity'=>$line['quantity'],
                'unit_cost'=>$line['unit_cost'],'line_total'=>round((float)$line['quantity']*(float)$line['unit_cost'],2),
            ]);
            return $po->load('supplier','items.item');
        });
        return response()->json(['data'=>$po],201);
    }

    public function updatePurchaseOrderStatus(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->own($request, $purchaseOrder);
        $data=$request->validate(['status'=>['required','in:ordered,cancelled']]);
        abort_unless($purchaseOrder->status==='draft',422,'Only draft purchase orders can be ordered or cancelled.');
        $purchaseOrder->update(['status'=>$data['status'],'ordered_at'=>$data['status']==='ordered'?now():null]);
        return response()->json(['data'=>$purchaseOrder->fresh(['supplier','items.item'])]);
    }

    public function receivePurchaseOrder(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->own($request,$purchaseOrder);
        $data=$request->validate([
            'lines'=>['required','array','min:1'],'lines.*.purchase_order_item_id'=>['required','integer','distinct'],
            'lines.*.quantity'=>['required','numeric','gt:0'],'lines.*.lot_no'=>['required','string','max:100'],
            'lines.*.manufactured_at'=>['nullable','date'],'lines.*.expires_at'=>['nullable','date'],
        ]);
        return response()->json(['data'=>$this->inventory->receive($purchaseOrder,$data['lines'],$request->user())]);
    }

    public function returnPurchaseOrder(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->own($request,$purchaseOrder);
        $data=$request->validate([
            'return_date'=>['required','date'],'reason'=>['nullable','string','max:255'],'notes'=>['nullable','string','max:2000'],
            'lines'=>['required','array','min:1'],'lines.*.purchase_order_item_id'=>['required','integer'],
            'lines.*.inventory_lot_id'=>['required','integer'],'lines.*.quantity'=>['required','numeric','gt:0'],
        ]);
        return response()->json(['data'=>$this->inventory->createReturn($purchaseOrder,$data,$request->user())],201);
    }

    public function storeDamage(Request $request)
    {
        $data=$request->validate([
            'inventory_item_id'=>['required','integer'],'inventory_lot_id'=>['nullable','integer'],
            'quantity'=>['required','numeric','gt:0'],'reason'=>['required','string','max:255'],'notes'=>['nullable','string','max:2000'],
        ]);
        $data['centre_id']=$this->primaryCentre($request)->id;
        return response()->json(['data'=>$this->inventory->recordDamage($data,$request->user())],201);
    }

    public function updateDamageStatus(Request $request, InventoryDamageReport $damage)
    {
        $this->own($request, $damage);
        $data = $request->validate(['status' => ['required', 'in:disposed,recovered']]);
        return response()->json(['data' => $this->inventory->resolveDamage($damage, $data['status'], $request->user())]);
    }

    public function storeStockCount(Request $request)
    {
        $data = $request->validate(['count_date' => ['required', 'date'], 'notes' => ['nullable', 'string', 'max:2000']]);
        $centre = $this->primaryCentre($request);
        $stockCount = DB::transaction(function () use ($data, $centre, $request) {
            $count = InventoryStockCount::create([
                'count_no' => 'SC-'.now()->format('ym').'-'.strtoupper(Str::random(6)),
                'centre_id' => $centre->id, 'count_date' => $data['count_date'],
                'notes' => $data['notes'] ?? null, 'created_by' => $request->user()->id,
            ]);
            $items = InventoryItem::where('centre_id', $centre->id)->where('status', 'active')->with('lots')->orderBy('name')->get();
            foreach ($items as $item) {
                $lots = $item->track_lots ? $item->lots->where('available_quantity', '>', 0) : collect();
                if ($lots->isEmpty()) {
                    $count->lines()->create([
                        'inventory_item_id' => $item->id, 'system_quantity' => $item->current_stock,
                        'unit_cost' => $item->average_cost,
                    ]);
                    continue;
                }
                foreach ($lots as $lot) {
                    $count->lines()->create([
                        'inventory_item_id' => $item->id, 'inventory_lot_id' => $lot->id,
                        'system_quantity' => $lot->available_quantity, 'unit_cost' => $lot->unit_cost,
                    ]);
                }
                $unallocated = round((float) $item->current_stock - (float) $lots->sum('available_quantity'), 2);
                abort_if($unallocated < 0, 422, "Lot balances exceed {$item->name}'s product balance. Correct movements before starting a count.");
                if ($unallocated > 0) {
                    $count->lines()->create([
                        'inventory_item_id' => $item->id, 'system_quantity' => $unallocated,
                        'unit_cost' => $item->average_cost,
                    ]);
                }
            }
            return $count->fresh(['lines.item:id,name,sku,unit', 'lines.lot:id,lot_no']);
        });
        return response()->json(['data' => $stockCount], 201);
    }

    public function postStockCount(Request $request, InventoryStockCount $stockCount)
    {
        $this->own($request, $stockCount);
        $data = $request->validate([
            'lines' => ['required', 'array', 'min:1'], 'lines.*.id' => ['required', 'integer', 'distinct'],
            'lines.*.counted_quantity' => ['required', 'numeric', 'min:0'],
        ]);
        return response()->json(['data' => $this->inventory->postStockCount($stockCount, $data['lines'], $request->user())]);
    }

    public function cancelStockCount(Request $request, InventoryStockCount $stockCount)
    {
        $this->own($request, $stockCount);
        abort_unless($stockCount->status === 'draft', 422, 'Only draft stock counts can be cancelled.');
        $stockCount->update(['status' => 'cancelled']);
        return response()->json(['data' => $stockCount]);
    }
}
