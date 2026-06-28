<?php

namespace App\Services;

use App\Models\InventoryDamageReport;
use App\Models\InventoryLot;
use App\Models\InventoryStockCount;
use App\Models\PurchaseOrder;
use App\Models\PurchaseReturn;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function postStockCount(InventoryStockCount $stockCount, array $submittedLines, User $user): InventoryStockCount
    {
        return DB::transaction(function () use ($stockCount, $submittedLines, $user) {
            $stockCount = InventoryStockCount::whereKey($stockCount->id)->lockForUpdate()->firstOrFail();
            if ($stockCount->status !== 'draft') {
                throw ValidationException::withMessages(['status' => 'Only draft stock counts can be posted.']);
            }

            $lines = $stockCount->lines()->with('item')->lockForUpdate()->get();
            $submitted = collect($submittedLines)->keyBy('id');
            if ($submitted->count() !== $lines->count() || $lines->contains(fn ($line) => ! $submitted->has($line->id))) {
                throw ValidationException::withMessages(['lines' => 'Every stock count line must have a counted quantity.']);
            }

            foreach ($lines->groupBy('inventory_item_id') as $itemLines) {
                $item = $itemLines->first()->item()->lockForUpdate()->firstOrFail();
                $snapshotTotal = round((float) $itemLines->sum('system_quantity'), 2);
                if (abs((float) $item->current_stock - $snapshotTotal) > 0.001) {
                    throw ValidationException::withMessages(['lines' => "{$item->name} changed after this count started. Cancel it and start a new count."]);
                }

                foreach ($itemLines as $line) {
                    if (! $line->inventory_lot_id) continue;
                    $lot = InventoryLot::where('inventory_item_id', $item->id)->whereKey($line->inventory_lot_id)->lockForUpdate()->firstOrFail();
                    if (abs((float) $lot->available_quantity - (float) $line->system_quantity) > 0.001) {
                        throw ValidationException::withMessages(['lines' => "Lot {$lot->lot_no} changed after this count started. Cancel it and start a new count."]);
                    }
                }

                $runningBalance = (float) $item->current_stock;
                $countedTotal = 0;
                foreach ($itemLines as $line) {
                    $counted = round((float) $submitted[$line->id]['counted_quantity'], 2);
                    $variance = round($counted - (float) $line->system_quantity, 2);
                    $countedTotal += $counted;
                    if ($line->inventory_lot_id) {
                        $lot = InventoryLot::whereKey($line->inventory_lot_id)->lockForUpdate()->firstOrFail();
                        $lot->update(['available_quantity' => $counted, 'status' => $counted > 0 ? 'active' : 'depleted']);
                    }
                    $line->update(['counted_quantity' => $counted, 'variance' => $variance]);
                    if (abs($variance) > 0.001) {
                        $runningBalance = round($runningBalance + $variance, 2);
                        StockMovement::create([
                            'inventory_item_id' => $item->id, 'inventory_lot_id' => $line->inventory_lot_id,
                            'movement_type' => 'adjust', 'quantity' => abs($variance), 'balance_after' => $runningBalance,
                            'reason' => "Stock count {$stockCount->count_no}", 'reference_type' => 'stock_count',
                            'reference_id' => $stockCount->id, 'unit_cost' => $line->unit_cost,
                            'created_by' => $user->id,
                        ]);
                    }
                }
                $item->update(['current_stock' => round($countedTotal, 2)]);
            }

            $stockCount->update(['status' => 'posted', 'posted_by' => $user->id, 'posted_at' => now()]);
            return $stockCount->fresh(['lines.item:id,name,sku,unit', 'lines.lot:id,lot_no']);
        });
    }

    public function receive(PurchaseOrder $po, array $lines, User $user): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $lines, $user) {
            $po->lockForUpdate();
            if (! in_array($po->status, ['ordered', 'partially_received'], true)) {
                throw ValidationException::withMessages(['status' => 'Only ordered purchase orders can be received.']);
            }

            foreach ($lines as $line) {
                if (! empty($line['manufactured_at']) && ! empty($line['expires_at']) && $line['expires_at'] < $line['manufactured_at']) {
                    throw ValidationException::withMessages(['expires_at' => 'Expiry date cannot be before manufacture date.']);
                }
                $poItem = $po->items()->with('item')->whereKey($line['purchase_order_item_id'])->lockForUpdate()->firstOrFail();
                $quantity = round((float) $line['quantity'], 2);
                $remaining = round((float) $poItem->ordered_quantity - (float) $poItem->received_quantity, 2);
                if ($quantity <= 0 || $quantity > $remaining) {
                    throw ValidationException::withMessages(['quantity' => "Receive quantity for {$poItem->item->name} cannot exceed {$remaining}."]);
                }

                $item = $poItem->item()->lockForUpdate()->first();
                $oldStock = (float) $item->current_stock;
                $newStock = round($oldStock + $quantity, 2);
                $average = $newStock > 0 ? round((($oldStock * (float) $item->average_cost) + ($quantity * (float) $poItem->unit_cost)) / $newStock, 2) : (float) $poItem->unit_cost;
                $item->update(['current_stock' => $newStock, 'average_cost' => $average, 'purchase_price' => $poItem->unit_cost]);
                $poItem->increment('received_quantity', $quantity);

                $lot = InventoryLot::firstOrNew([
                    'centre_id' => $po->centre_id,
                    'inventory_item_id' => $item->id,
                    'lot_no' => $line['lot_no'],
                ]);
                if ($lot->exists && $lot->purchase_order_item_id !== $poItem->id) {
                    throw ValidationException::withMessages(['lot_no' => "Lot {$line['lot_no']} already belongs to another receipt."]);
                }
                $lot->supplier_id = $po->supplier_id;
                $lot->purchase_order_item_id = $poItem->id;
                $lot->manufactured_at = $line['manufactured_at'] ?? $lot->manufactured_at;
                $lot->expires_at = $line['expires_at'] ?? $lot->expires_at;
                $lot->received_quantity = (float) ($lot->received_quantity ?? 0) + $quantity;
                $lot->available_quantity = (float) ($lot->available_quantity ?? 0) + $quantity;
                $lot->unit_cost = $poItem->unit_cost;
                $lot->status = 'active';
                $lot->save();

                StockMovement::create([
                    'inventory_item_id' => $item->id, 'inventory_lot_id' => $lot->id,
                    'movement_type' => 'in', 'quantity' => $quantity, 'balance_after' => $newStock,
                    'reason' => "PO receipt {$po->po_no} · lot {$lot->lot_no}",
                    'reference_type' => 'purchase_order', 'reference_id' => $po->id,
                    'unit_cost' => $poItem->unit_cost, 'created_by' => $user->id,
                ]);
            }

            $po->load('items');
            $complete = $po->items->every(fn ($line) => (float) $line->received_quantity >= (float) $line->ordered_quantity);
            $po->update(['status' => $complete ? 'received' : 'partially_received', 'received_at' => $complete ? now() : null]);

            return $po->fresh(['supplier', 'items.item']);
        });
    }

    public function createReturn(PurchaseOrder $po, array $data, User $user): PurchaseReturn
    {
        return DB::transaction(function () use ($po, $data, $user) {
            $return = PurchaseReturn::create([
                'return_no' => 'PR-'.now()->format('ym').'-'.strtoupper(Str::random(6)),
                'centre_id' => $po->centre_id, 'purchase_order_id' => $po->id,
                'supplier_id' => $po->supplier_id, 'return_date' => $data['return_date'],
                'reason' => $data['reason'] ?? null, 'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);
            $total = 0;
            foreach ($data['lines'] as $line) {
                $poItem = $po->items()->with('item')->whereKey($line['purchase_order_item_id'])->lockForUpdate()->firstOrFail();
                $lot = InventoryLot::where('centre_id', $po->centre_id)->where('inventory_item_id', $poItem->inventory_item_id)->whereKey($line['inventory_lot_id'])->lockForUpdate()->firstOrFail();
                $quantity = round((float) $line['quantity'], 2);
                $returnable = min((float) $lot->available_quantity, (float) $poItem->received_quantity - (float) $poItem->returned_quantity);
                if ($quantity <= 0 || $quantity > $returnable) {
                    throw ValidationException::withMessages(['quantity' => "Return quantity for {$poItem->item->name} cannot exceed {$returnable}."]);
                }
                $item = $poItem->item()->lockForUpdate()->first();
                $balance = round((float) $item->current_stock - $quantity, 2);
                if ($balance < 0) throw ValidationException::withMessages(['quantity' => 'Return would make stock negative.']);
                $item->update(['current_stock' => $balance]);
                $lot->decrement('available_quantity', $quantity);
                if ((float) $lot->fresh()->available_quantity <= 0) $lot->update(['status' => 'depleted']);
                $poItem->increment('returned_quantity', $quantity);
                $lineTotal = round($quantity * (float) $poItem->unit_cost, 2);
                $total += $lineTotal;
                $return->items()->create([
                    'purchase_order_item_id' => $poItem->id, 'inventory_item_id' => $item->id,
                    'inventory_lot_id' => $lot->id, 'quantity' => $quantity,
                    'unit_cost' => $poItem->unit_cost, 'line_total' => $lineTotal,
                ]);
                StockMovement::create([
                    'inventory_item_id' => $item->id, 'inventory_lot_id' => $lot->id,
                    'movement_type' => 'out', 'quantity' => $quantity, 'balance_after' => $balance,
                    'reason' => "Purchase return {$return->return_no}", 'reference_type' => 'purchase_return',
                    'reference_id' => $return->id, 'unit_cost' => $poItem->unit_cost, 'created_by' => $user->id,
                ]);
            }
            $return->update(['total_amount' => round($total, 2)]);
            return $return->fresh(['supplier', 'purchaseOrder', 'items.item', 'items.lot']);
        });
    }

    public function recordDamage(array $data, User $user): InventoryDamageReport
    {
        return DB::transaction(function () use ($data, $user) {
            $item = \App\Models\InventoryItem::where('centre_id', $data['centre_id'])->whereKey($data['inventory_item_id'])->lockForUpdate()->firstOrFail();
            $quantity = round((float) $data['quantity'], 2);
            if ($quantity <= 0 || $quantity > (float) $item->current_stock) throw ValidationException::withMessages(['quantity' => 'Damage quantity exceeds current stock.']);
            $lot = null;
            if (! empty($data['inventory_lot_id'])) {
                $lot = InventoryLot::where('centre_id', $data['centre_id'])->where('inventory_item_id', $item->id)->whereKey($data['inventory_lot_id'])->lockForUpdate()->firstOrFail();
                if ($quantity > (float) $lot->available_quantity) throw ValidationException::withMessages(['quantity' => 'Damage quantity exceeds lot availability.']);
                $lot->decrement('available_quantity', $quantity);
                $lot->increment('damaged_quantity', $quantity);
                if ((float) $lot->fresh()->available_quantity <= 0) $lot->update(['status' => 'depleted']);
            } elseif ($item->track_lots && InventoryLot::where('inventory_item_id', $item->id)->where('available_quantity', '>', 0)->exists()) {
                throw ValidationException::withMessages(['inventory_lot_id' => 'Select the affected lot for this tracked product.']);
            }
            $balance = round((float) $item->current_stock - $quantity, 2);
            $item->update(['current_stock' => $balance, 'condition' => $balance <= 0 ? 'damaged' : $item->condition]);
            $report = InventoryDamageReport::create([
                'report_no' => 'DMG-'.now()->format('ym').'-'.strtoupper(Str::random(6)),
                'centre_id' => $data['centre_id'], 'inventory_item_id' => $item->id,
                'inventory_lot_id' => $lot?->id, 'quantity' => $quantity,
                'reason' => $data['reason'], 'notes' => $data['notes'] ?? null,
                'status' => 'recorded', 'created_by' => $user->id,
            ]);
            StockMovement::create([
                'inventory_item_id' => $item->id, 'inventory_lot_id' => $lot?->id,
                'movement_type' => 'damage', 'quantity' => $quantity, 'balance_after' => $balance,
                'reason' => $data['reason'], 'reference_type' => 'damage_report', 'reference_id' => $report->id,
                'unit_cost' => $lot?->unit_cost ?? $item->average_cost, 'created_by' => $user->id,
            ]);
            return $report->load('item', 'lot');
        });
    }

    public function resolveDamage(InventoryDamageReport $report, string $status, User $user): InventoryDamageReport
    {
        return DB::transaction(function () use ($report, $status, $user) {
            $report->lockForUpdate();
            if ($report->status !== 'recorded') {
                throw ValidationException::withMessages(['status' => 'This damage report is already resolved.']);
            }
            if ($status === 'recovered') {
                $item = $report->item()->lockForUpdate()->first();
                $balance = round((float) $item->current_stock + (float) $report->quantity, 2);
                $item->update(['current_stock' => $balance, 'condition' => 'good']);
                $lot = $report->inventory_lot_id ? InventoryLot::whereKey($report->inventory_lot_id)->lockForUpdate()->first() : null;
                if ($lot) {
                    $lot->increment('available_quantity', $report->quantity);
                    $lot->update(['damaged_quantity' => max(round((float) $lot->damaged_quantity - (float) $report->quantity, 2), 0), 'status' => 'active']);
                }
                StockMovement::create([
                    'inventory_item_id'=>$item->id,'inventory_lot_id'=>$lot?->id,'movement_type'=>'return',
                    'quantity'=>$report->quantity,'balance_after'=>$balance,'reason'=>"Recovered damage {$report->report_no}",
                    'reference_type'=>'damage_report','reference_id'=>$report->id,'unit_cost'=>$lot?->unit_cost ?? $item->average_cost,'created_by'=>$user->id,
                ]);
            }
            $report->update(['status' => $status]);
            return $report->fresh(['item', 'lot']);
        });
    }
}
