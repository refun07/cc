<?php

namespace Database\Seeders;

use App\Models\AvailabilitySlot;
use App\Models\CommunityCentre;
use App\Models\User;
use App\Models\WasteStream;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@dscc.test'],
            ['name' => 'ICCMS Admin', 'phone' => '01700000000', 'role' => 'admin', 'password' => Hash::make('password')]
        );

        $facilityPool = [
            ['name' => 'Air Conditioning', 'icon' => 'snowflake'],
            ['name' => 'Parking', 'icon' => 'car'],
            ['name' => 'Stage & Lighting', 'icon' => 'sparkles'],
            ['name' => 'Sound System', 'icon' => 'speaker'],
            ['name' => 'Bridal Room', 'icon' => 'door'],
            ['name' => 'Generator Backup', 'icon' => 'bolt'],
            ['name' => 'Catering Kitchen', 'icon' => 'utensils'],
            ['name' => 'CCTV Security', 'icon' => 'shield'],
        ];

        $menuPool = [
            ['name' => 'Traditional Bangla Menu', 'menu_type' => 'Bangla', 'price' => 650, 'min' => 50,
                'items' => 'Plain Rice, Beef Rezala, Chicken Roast, Borhani, Salad, Firni', 'desc' => 'Classic Bengali feast for weddings and large gatherings.'],
            ['name' => 'Premium Wedding Menu', 'menu_type' => 'Premium', 'price' => 1100, 'min' => 80,
                'items' => 'Kacchi Biryani, Mutton Rezala, Roast Chicken, Borhani, Jorda, Salad, Dessert', 'desc' => 'Premium kacchi-led wedding package.'],
            ['name' => 'Corporate Lunch', 'menu_type' => 'Corporate', 'price' => 450, 'min' => 30,
                'items' => 'Pulao, Chicken Curry, Vegetable, Dal, Salad, Soft Drink', 'desc' => 'Balanced lunch package for corporate events.'],
            ['name' => 'Evening Snacks', 'menu_type' => 'Snacks', 'price' => 250, 'min' => 20,
                'items' => 'Samosa, Singara, Sandwich, Tea/Coffee, Sweets', 'desc' => 'Light snacks for seminars and meetings.'],
            ['name' => 'Vegetarian Menu', 'menu_type' => 'Vegetarian', 'price' => 400, 'min' => 25,
                'items' => 'Vegetable Pulao, Paneer, Mixed Veg, Dal, Salad, Sweet', 'desc' => 'Full vegetarian spread.'],
        ];

        $centres = [
            ['name' => 'Dhanmondi Community Centre', 'area' => 'Dhanmondi', 'cap' => 500, 'half' => 35000, 'full' => 60000, 'rating' => 4.7],
            ['name' => 'Gulshan Grand Hall', 'area' => 'Gulshan', 'cap' => 800, 'half' => 55000, 'full' => 95000, 'rating' => 4.8],
            ['name' => 'Motijheel Convention Centre', 'area' => 'Motijheel', 'cap' => 350, 'half' => 28000, 'full' => 48000, 'rating' => 4.4],
            ['name' => 'Lalbagh Heritage Hall', 'area' => 'Lalbagh', 'cap' => 250, 'half' => 20000, 'full' => 36000, 'rating' => 4.2],
            ['name' => 'Wari Family Centre', 'area' => 'Wari', 'cap' => 300, 'half' => 24000, 'full' => 42000, 'rating' => 4.5],
            ['name' => 'Jatrabari Banquet', 'area' => 'Jatrabari', 'cap' => 600, 'half' => 38000, 'full' => 66000, 'rating' => 4.3],
        ];

        $gallery = [
            'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=70',
            'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=70',
            'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=70',
            'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=70',
        ];

        foreach ($centres as $i => $c) {
            $owner = User::updateOrCreate(
                ['email' => 'owner'.($i + 1).'@dscc.test'],
                ['name' => $c['name'].' Owner', 'phone' => '0171000000'.$i, 'role' => 'owner', 'password' => Hash::make('password')]
            );

            $centre = CommunityCentre::updateOrCreate(
                ['slug' => Str::slug($c['name'])],
                [
                    'owner_id' => $owner->id,
                    'name' => $c['name'],
                    'booking_prefix' => 'ICCMS',
                    'area' => $c['area'],
                    'address' => $c['area'].', Dhaka South City Corporation, Bangladesh',
                    'description' => "A verified ICCMS community centre in {$c['area']} offering full-day and half-day event bookings with in-house catering, decoration, and zero waste management support.",
                    'capacity' => $c['cap'],
                    'base_price' => $c['half'],
                    'half_day_price' => $c['half'],
                    'full_day_price' => $c['full'],
                    'rating' => $c['rating'],
                    'status' => 'active',
                    'is_verified' => true,
                    'virtual_tour_url' => 'https://www.nhvirtualtour.com/en/nh-las-artes/',
                    'cover_image' => 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=70',
                ]
            );

            $centre->images()->delete();
            foreach ($gallery as $idx => $url) {
                $centre->images()->create(['image_path' => $url, 'type' => 'gallery', 'sort_order' => $idx]);
            }

            $centre->facilities()->delete();
            foreach (collect($facilityPool)->random(5) as $f) {
                $centre->facilities()->create($f);
            }

            $centre->foodMenus()->delete();
            foreach (collect($menuPool)->random(4) as $m) {
                $centre->foodMenus()->create([
                    'name' => $m['name'],
                    'description' => $m['desc'],
                    'items' => $m['items'],
                    'price_per_person' => $m['price'],
                    'menu_type' => $m['menu_type'],
                    'min_guest_count' => $m['min'],
                    'status' => 'active',
                ]);
            }

            AvailabilitySlot::where('centre_id', $centre->id)->delete();
            for ($d = 1; $d <= 45; $d++) {
                $date = now()->addDays($d)->format('Y-m-d');
                foreach (['full_day', 'half_day_morning', 'half_day_evening'] as $session) {
                    AvailabilitySlot::create([
                        'centre_id' => $centre->id,
                        'date' => $date,
                        'session_type' => $session,
                        'status' => ($d % 9 === 0) ? 'blocked' : 'available',
                    ]);
                }
            }
        }

        User::updateOrCreate(
            ['email' => 'customer@dscc.test'],
            ['name' => 'Demo Customer', 'phone' => '01800000000', 'role' => 'customer', 'password' => Hash::make('password')]
        );

        $partner = User::updateOrCreate(
            ['email' => 'partner@dscc.test'],
            ['name' => 'Green Dhaka Recycling', 'phone' => '01900000000', 'role' => 'waste_partner', 'password' => Hash::make('password')]
        );

        $seedWaste = [
            ['centre' => 0, 'type' => 'Organic food waste', 'quantity' => 85, 'status' => 'pickup_assigned', 'partner' => null, 'schedule' => null],
            ['centre' => 1, 'type' => 'Plastic bottles', 'quantity' => 32, 'status' => 'pickup_assigned', 'partner' => null, 'schedule' => null],
            ['centre' => 2, 'type' => 'Paper plates and cups', 'quantity' => 46, 'status' => 'pickup_assigned', 'partner' => $partner->id, 'schedule' => now()->addDay()->setTime(10, 30)],
            ['centre' => 3, 'type' => 'Mixed event waste', 'quantity' => 64, 'status' => 'collected', 'partner' => $partner->id, 'schedule' => now()->subHours(4)],
            ['centre' => 4, 'type' => 'Cardboard packaging', 'quantity' => 28, 'status' => 'recycled', 'partner' => $partner->id, 'schedule' => now()->subDays(2)],
            ['centre' => 5, 'type' => 'Reusable décor items', 'quantity' => 40, 'status' => 'returned_to_inventory', 'partner' => $partner->id, 'schedule' => now()->subDays(5)],
        ];
        $centreIds = CommunityCentre::orderBy('id')->pluck('id')->values();
        foreach ($seedWaste as $row) {
            $centreId = $centreIds->get($row['centre']);
            if (! $centreId) {
                continue;
            }

            WasteStream::updateOrCreate(
                ['centre_id' => $centreId, 'waste_type' => $row['type']],
                [
                    'quantity' => $row['quantity'],
                    'unit' => $row['type'] === 'Reusable décor items' ? 'pcs' : 'kg',
                    'status' => $row['status'],
                    'notes' => 'Seeded event waste pickup for partner workflow demo.',
                    'assigned_partner_id' => $row['partner'],
                    'pickup_scheduled_for' => $row['schedule'],
                    'collected_at' => in_array($row['status'], ['collected', 'recycled', 'returned_to_inventory'], true) ? now()->subHours(3) : null,
                    'processed_at' => in_array($row['status'], ['recycled', 'returned_to_inventory'], true) ? now()->subHours(2) : null,
                ]
            );
        }
    }
}
