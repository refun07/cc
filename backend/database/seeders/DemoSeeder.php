<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\CrmContact;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\InventoryDamageReport;
use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\InventoryStockCount;
use App\Models\InventoryStockCountLine;
use App\Models\InventorySupplier;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use App\Models\User;
use App\Models\WasteStream;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $customer = User::where('role', 'customer')->first()
            ?? User::factory()->create(['role' => 'customer', 'phone' => '01800000000']);

        $customers = [
            ['Ayesha Rahman', '01811111111'], ['Tanvir Hasan', '01822222222'],
            ['Nadia Islam', '01833333333'], ['Rafiq Chowdhury', '01844444444'],
            ['Sumaiya Akter', '01855555555'], ['Imran Kabir', '01866666666'],
        ];
        $events = ['Wedding', 'Corporate Conference', 'Birthday', 'Mehndi', 'Seminar', 'Reception', 'Annual Dinner'];
        $sessions = ['full_day', 'half_day_morning', 'half_day_evening'];
        $statuses = ['pending_review', 'payment_pending', 'confirmed', 'confirmed', 'completed', 'completed', 'cancelled'];

        $invPool = [
            ['Round Tables', 'Furniture', 80, 20, 'pcs'], ['Chiavari Chairs', 'Furniture', 600, 100, 'pcs'],
            ['Table Cloths', 'Linen', 150, 40, 'pcs'], ['Sound System', 'Electronics', 4, 2, 'set'],
            ['Cordless Mic', 'Electronics', 8, 3, 'pcs'], ['Generator', 'Electronics', 2, 1, 'unit'],
            ['Basmati Rice', 'Food stock', 35, 50, 'kg'], ['Chafing Dishes', 'Kitchen', 25, 10, 'pcs'],
            ['Stage Backdrop', 'Decoration', 3, 1, 'set'], ['Reusable Centerpieces', 'Reusable décor', 40, 15, 'pcs'],
        ];
        $staffPool = [
            ['Abdul Karim', 'Venue Manager', 35000], ['Shahidul Islam', 'Security Guard', 16000],
            ['Mitu Begum', 'Cleaner', 12000], ['Jahangir Alam', 'Maintenance Staff', 18000],
            ['Farhana Yasmin', 'Front Desk Officer', 22000], ['Babul Mia', 'Catering Lead', 28000],
        ];
        $expensePool = [
            ['Monthly electricity bill', 'Electricity', 'DPDC', 18500, 'paid', 'Bank Transfer'],
            ['Generator diesel', 'Generator fuel', 'Padma Oil', 9200, 'paid', 'Cash'],
            ['Hall deep cleaning', 'Cleaning', 'SparkClean BD', 6500, 'pending', 'bKash'],
            ['Sound system repair', 'Maintenance', 'AudioFix', 4300, 'paid', 'bKash'],
            ['Security service', 'Security', 'SafeGuard Ltd', 25000, 'pending', 'Bank Transfer'],
            ['Linen laundry', 'Linen wash', 'FreshWash', 3100, 'paid', 'Cash'],
            ['Decoration vendor', 'Vendor payment', 'Floral Events', 14000, 'pending', 'Bank Transfer'],
        ];
        $wastePool = [
            ['Organic food waste', 65, 'composted'], ['Plastic bottles', 28, 'recycled'],
            ['Cardboard packaging', 40, 'recycling_assigned'], ['Mixed event waste', 55, 'pickup_assigned'],
            ['Glass bottles', 18, 'collected'], ['Reusable décor items', 22, 'returned_to_inventory'],
            ['Paper plates and cups', 33, 'sorting_required'],
        ];

        foreach (CommunityCentre::orderBy('id')->take(3)->get() as $ci => $centre) {
            // Inventory
            foreach ($invPool as $it) {
                $perishable = in_array($it[1], ['Food stock', 'Linen'], true);
                InventoryItem::firstOrCreate(
                    ['centre_id' => $centre->id, 'name' => $it[0]],
                    ['category' => $it[1], 'product_type' => $perishable ? 'perishable' : 'physical', 'current_stock' => $it[2], 'minimum_stock' => $it[3], 'unit' => $it[4], 'condition' => 'good', 'status' => 'active', 'sku' => strtoupper(Str::random(6))]
                );
            }
            // ---- Procurement: suppliers, POs, lots, returns, damage, stock counts ----
            $this->seedProcurement($centre);

            // Staff + today attendance
            foreach ($staffPool as $si => $st) {
                $emp = Employee::firstOrCreate(
                    ['centre_id' => $centre->id, 'name' => $st[0]],
                    ['designation' => $st[1], 'salary' => $st[2], 'status' => 'active', 'phone' => '019'.rand(10000000, 99999999), 'joined_at' => now()->subMonths(rand(2, 20))]
                );
                if (! $emp->employee_code) {
                    $emp->update(['employee_code' => 'EMP-'.str_pad($emp->id, 4, '0', STR_PAD_LEFT)]);
                }
                Attendance::updateOrCreate(
                    ['employee_id' => $emp->id, 'date' => now()->toDateString()],
                    ['status' => $si % 4 === 0 ? 'absent' : 'present']
                );
            }
            // Expenses
            foreach ($expensePool as $ex) {
                Expense::firstOrCreate(
                    ['centre_id' => $centre->id, 'title' => $ex[0]],
                    ['category' => $ex[1], 'vendor' => $ex[2], 'amount' => $ex[3], 'status' => $ex[4], 'payment_method' => $ex[5], 'expense_date' => now()->subDays(rand(1, 40))->toDateString(), 'reference_no' => 'EXP-'.strtoupper(Str::random(5))]
                );
            }
            // Waste streams
            foreach ($wastePool as $w) {
                WasteStream::firstOrCreate(
                    ['centre_id' => $centre->id, 'waste_type' => $w[0]],
                    ['quantity' => $w[1], 'unit' => 'kg', 'status' => $w[2]]
                );
            }
            // Bookings
            for ($b = 0; $b < 8; $b++) {
                [$cname, $cphone] = $customers[array_rand($customers)];
                $session = $sessions[array_rand($sessions)];
                $status = $statuses[array_rand($statuses)];
                $guests = rand(50, $centre->capacity);
                $venue = $session === 'full_day' ? (float) $centre->full_day_price : (float) $centre->half_day_price;
                $food = rand(0, 1) ? $guests * (rand(0, 1) ? 650 : 450) : 0;
                $sub = $venue + $food;
                $service = round($sub * 0.05, 2);
                $vat = round(($sub + $service) * 0.075, 2);
                $total = round($sub + $service + $vat, 2);
                $paid = in_array($status, ['confirmed', 'completed']) ? $total : (in_array($status, ['payment_pending']) ? 0 : 0);
                if ($status === 'cancelled') {
                    $paid = 0;
                }

                $booking = Booking::create([
                    'booking_no' => 'ICCMS-'.strtoupper(Str::random(8)),
                    'user_id' => $customer->id,
                    'centre_id' => $centre->id,
                    'customer_name' => $cname,
                    'customer_phone' => $cphone,
                    'customer_email' => Str::slug($cname).'@example.com',
                    'event_date' => now()->addDays(rand(-20, 40))->toDateString(),
                    'session_type' => $session,
                    'guest_count' => $guests,
                    'event_type' => $events[array_rand($events)],
                    'venue_amount' => $venue,
                    'food_amount' => $food,
                    'service_charge' => $service,
                    'vat_amount' => $vat,
                    'total_amount' => $total,
                    'payment_option' => 'full',
                    'advance_amount' => round($total * 0.3, 2),
                    'paid_amount' => $paid,
                    'due_amount' => round($total - $paid, 2),
                    'status' => $status,
                ]);

                $booking->bookingDates()->create([
                    'date' => $booking->event_date,
                    'session_type' => $booking->session_type,
                ]);
                CrmContact::updateOrCreate(
                    ['centre_id' => $centre->id, 'phone' => $cphone],
                    ['name' => $cname, 'email' => Str::slug($cname).'@example.com', 'stage' => 'customer', 'source' => 'booking']
                );

                if ($paid > 0) {
                    Payment::create([
                        'booking_id' => $booking->id,
                        'payment_method' => ['bKash', 'Nagad', 'Card', 'SSLCommerz'][array_rand([0, 1, 2, 3])],
                        'transaction_id' => 'TXN-'.strtoupper(Str::random(10)),
                        'amount' => $paid,
                        'status' => 'paid',
                        'paid_at' => now()->subDays(rand(0, 15)),
                    ]);
                }
            }
        }

        $this->command->info('Demo data seeded for 3 centres (inventory, staff, attendance, expenses, waste, bookings).');
    }

    /** Seed suppliers, purchase orders, lots, returns, damage reports and stock counts for a centre. */
    private function seedProcurement(CommunityCentre $centre): void
    {
        if (PurchaseOrder::where('centre_id', $centre->id)->exists()) {
            return; // already seeded
        }

        $suppliers = [
            ['Meghna Furniture Ltd', 'Rakib Hasan', '01710000001', 'sales@meghnafurniture.com', 'Tejgaon I/A, Dhaka', '30 days'],
            ['Bengal Electronics', 'Sadia Noor', '01710000002', 'info@bengalelectronics.com', 'Nawabpur Road, Dhaka', '15 days'],
            ['FreshMart Catering Supplies', 'Kamal Uddin', '01710000003', 'order@freshmartbd.com', 'Karwan Bazar, Dhaka', 'Cash on delivery'],
            ['DecoWorld BD', 'Nusrat Jahan', '01710000004', 'hello@decoworld.com.bd', 'Mirpur 10, Dhaka', '30 days'],
        ];
        $supplierModels = [];
        foreach ($suppliers as $s) {
            $supplierModels[] = InventorySupplier::create([
                'centre_id' => $centre->id, 'name' => $s[0], 'contact_person' => $s[1],
                'phone' => $s[2], 'email' => $s[3], 'address' => $s[4],
                'tax_id' => 'BIN-'.rand(100000000, 999999999), 'payment_terms' => $s[5],
                'status' => 'active', 'notes' => 'Preferred supplier.',
            ]);
        }

        $items = InventoryItem::where('centre_id', $centre->id)->get();
        if ($items->isEmpty()) {
            return;
        }

        // Three purchase orders in different states: received, ordered, draft.
        $poBlueprints = [
            ['status' => 'received', 'days_ago' => 25, 'receive' => 1.0],
            ['status' => 'partially_received', 'days_ago' => 10, 'receive' => 0.5],
            ['status' => 'ordered', 'days_ago' => 4, 'receive' => 0.0],
            ['status' => 'draft', 'days_ago' => 1, 'receive' => 0.0],
        ];

        $receivedLots = [];
        foreach ($poBlueprints as $bp) {
            $supplier = $supplierModels[array_rand($supplierModels)];
            $lineItems = $items->random(min(3, $items->count()));
            $orderDate = now()->subDays($bp['days_ago']);

            $po = PurchaseOrder::create([
                'po_no' => 'PO-'.strtoupper(Str::random(6)),
                'centre_id' => $centre->id, 'supplier_id' => $supplier->id,
                'order_date' => $orderDate->toDateString(),
                'expected_date' => $orderDate->copy()->addDays(7)->toDateString(),
                'status' => $bp['status'],
                'discount_amount' => 0, 'tax_amount' => 0,
                'notes' => 'Auto-seeded demo order.',
                'created_by' => null,
                'ordered_at' => in_array($bp['status'], ['ordered', 'partially_received', 'received']) ? $orderDate : null,
                'received_at' => $bp['status'] === 'received' ? $orderDate->copy()->addDays(6) : null,
            ]);

            $subtotal = 0;
            foreach ($lineItems as $item) {
                $qty = rand(10, 60);
                $cost = max(round(($item->average_cost ?: $item->purchase_price ?: rand(80, 900)), 2), 50);
                $lineTotal = round($qty * $cost, 2);
                $subtotal += $lineTotal;
                $received = round($qty * $bp['receive'], 2);

                $poItem = PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id, 'inventory_item_id' => $item->id,
                    'ordered_quantity' => $qty, 'received_quantity' => $received,
                    'returned_quantity' => 0, 'unit_cost' => $cost, 'line_total' => $lineTotal,
                ]);

                // Create a lot for received quantity.
                if ($received > 0) {
                    $lot = InventoryLot::create([
                        'centre_id' => $centre->id, 'inventory_item_id' => $item->id,
                        'supplier_id' => $supplier->id, 'purchase_order_item_id' => $poItem->id,
                        'lot_no' => 'LOT-'.strtoupper(Str::random(6)),
                        'manufactured_at' => $orderDate->copy()->subDays(rand(5, 30))->toDateString(),
                        'expires_at' => in_array($item->category, ['Food stock', 'Linen'])
                            ? now()->addDays(rand(-5, 90))->toDateString() : null,
                        'received_quantity' => $received, 'available_quantity' => $received,
                        'damaged_quantity' => 0, 'unit_cost' => $cost, 'status' => 'active',
                    ]);
                    $receivedLots[] = [$lot, $poItem, $item, $supplier, $po];
                }
            }

            $po->update([
                'subtotal' => $subtotal, 'total_amount' => $subtotal,
            ]);
        }

        // A confirmed PO return against one received lot.
        if (! empty($receivedLots)) {
            [$lot, $poItem, $item, $supplier, $po] = $receivedLots[0];
            $returnQty = max(round($lot->available_quantity * 0.15, 2), 1);
            $return = PurchaseReturn::create([
                'return_no' => 'RET-'.strtoupper(Str::random(6)),
                'centre_id' => $centre->id, 'purchase_order_id' => $po->id, 'supplier_id' => $supplier->id,
                'return_date' => now()->subDays(3)->toDateString(), 'status' => 'confirmed',
                'total_amount' => round($returnQty * $lot->unit_cost, 2),
                'reason' => 'Defective on arrival', 'notes' => 'Returned to supplier.', 'created_by' => null,
            ]);
            PurchaseReturnItem::create([
                'purchase_return_id' => $return->id, 'purchase_order_item_id' => $poItem->id,
                'inventory_item_id' => $item->id, 'inventory_lot_id' => $lot->id,
                'quantity' => $returnQty, 'unit_cost' => $lot->unit_cost,
                'line_total' => round($returnQty * $lot->unit_cost, 2),
            ]);
            $lot->update(['available_quantity' => max($lot->available_quantity - $returnQty, 0)]);
            $poItem->update(['returned_quantity' => $returnQty]);
        }

        // A recorded damage report against another lot.
        if (count($receivedLots) > 1) {
            [$lot, , $item] = $receivedLots[1];
            $dmgQty = max(round($lot->available_quantity * 0.1, 2), 1);
            InventoryDamageReport::create([
                'report_no' => 'DMG-'.strtoupper(Str::random(6)),
                'centre_id' => $centre->id, 'inventory_item_id' => $item->id, 'inventory_lot_id' => $lot->id,
                'quantity' => $dmgQty, 'reason' => 'Broken during event handling',
                'notes' => 'Set aside for disposal review.', 'status' => 'recorded', 'created_by' => null,
            ]);
            $lot->update([
                'available_quantity' => max($lot->available_quantity - $dmgQty, 0),
                'damaged_quantity' => $lot->damaged_quantity + $dmgQty,
            ]);
        }

        // One posted stock count and one draft stock count.
        foreach ([['posted', 20], ['draft', 2]] as [$status, $daysAgo]) {
            $count = InventoryStockCount::create([
                'count_no' => 'SC-'.strtoupper(Str::random(6)),
                'centre_id' => $centre->id, 'count_date' => now()->subDays($daysAgo)->toDateString(),
                'status' => $status, 'notes' => 'Periodic physical count.',
                'created_by' => null, 'posted_by' => null,
                'posted_at' => $status === 'posted' ? now()->subDays($daysAgo) : null,
            ]);
            foreach ($items->random(min(4, $items->count())) as $item) {
                $system = (float) $item->current_stock;
                $counted = $status === 'posted' ? $system + rand(-3, 3) : $system;
                InventoryStockCountLine::create([
                    'inventory_stock_count_id' => $count->id, 'inventory_item_id' => $item->id,
                    'inventory_lot_id' => null, 'system_quantity' => $system,
                    'counted_quantity' => max($counted, 0), 'variance' => max($counted, 0) - $system,
                    'unit_cost' => $item->average_cost ?: $item->purchase_price ?: 0,
                ]);
            }
        }
    }
}
