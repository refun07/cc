<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\CrmContact;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\InventoryItem;
use App\Models\Payment;
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
                InventoryItem::firstOrCreate(
                    ['centre_id' => $centre->id, 'name' => $it[0]],
                    ['category' => $it[1], 'current_stock' => $it[2], 'minimum_stock' => $it[3], 'unit' => $it[4], 'condition' => 'good', 'status' => 'active', 'sku' => strtoupper(Str::random(6))]
                );
            }
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
                    'booking_no' => 'DSCC-'.strtoupper(Str::random(8)),
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
}
