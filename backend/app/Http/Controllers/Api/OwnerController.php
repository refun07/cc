<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Attendance;
use App\Models\AvailabilitySlot;
use App\Models\Booking;
use App\Models\CentreImage;
use App\Models\CommunityCentre;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\FoodMenu;
use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\Payroll;
use App\Models\Settlement;
use App\Models\User;
use App\Models\WasteStream;
use App\Models\StockMovement;
use App\Services\BookingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OwnerController extends Controller
{
    public function __construct(protected BookingService $bookings) {}

    /** The centres owned by the signed-in owner. */
    protected function centres(Request $request)
    {
        return CommunityCentre::where('owner_id', $request->user()->id);
    }

    protected function primaryCentre(Request $request): ?CommunityCentre
    {
        return $this->centres($request)->first();
    }

    /** Ensure a centre id belongs to this owner. */
    protected function ownCentreId(Request $request, $id): int
    {
        $centre = $this->centres($request)->where('id', $id)->first();
        abort_unless($centre, 403, 'This centre does not belong to you.');

        return $centre->id;
    }

    public function dashboard(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        $paid = ['paid', 'confirmed', 'completed'];

        $revenue = (float) Booking::whereIn('centre_id', $ids)->whereIn('status', $paid)->sum('paid_amount');
        $upcoming = Booking::whereIn('centre_id', $ids)
            ->whereIn('status', ['confirmed', 'payment_pending'])
            ->whereDate('event_date', '>=', now()->toDateString())
            ->count();

        return response()->json([
            'centre' => $this->primaryCentre($request)?->only(['id', 'name', 'slug', 'area', 'status', 'rating', 'cover_image']),
            'stats' => [
                'revenue' => $revenue,
                'bookings' => Booking::whereIn('centre_id', $ids)->count(),
                'pending_review' => Booking::whereIn('centre_id', $ids)->where('status', 'pending_review')->count(),
                'upcoming' => $upcoming,
                'confirmed' => Booking::whereIn('centre_id', $ids)->where('status', 'confirmed')->count(),
                'completed' => Booking::whereIn('centre_id', $ids)->where('status', 'completed')->count(),
                'menus' => FoodMenu::whereIn('centre_id', $ids)->count(),
                'due_amount' => (float) Booking::whereIn('centre_id', $ids)->whereIn('status', $paid)->sum('due_amount'),
            ],
            'recent_bookings' => BookingResource::collection(
                Booking::whereIn('centre_id', $ids)->with('centre', 'payment', 'foodItems', 'bookingDates')->latest()->limit(8)->get()
            ),
        ]);
    }

    public function bookings(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        $rows = Booking::whereIn('centre_id', $ids)
            ->with('centre', 'payment', 'foodItems', 'bookingDates')
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->latest()
            ->limit(100)
            ->get();

        return BookingResource::collection($rows);
    }

    /** Owner creates a walk-in booking for their own centre. */
    public function storeBooking(Request $request)
    {
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email'],
            'event_date' => ['required', 'date', 'after_or_equal:today'],
            'session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
            'guest_count' => ['required', 'integer', 'min:1'],
            'event_type' => ['nullable', 'string', 'max:255'],
            'food_selections' => ['nullable', 'array'],
            'food_selections.*.food_menu_id' => ['required', 'integer', 'distinct'],
            'food_selections.*.quantity' => ['nullable', 'integer', 'min:1'],
            'adjustment_amount' => ['nullable', 'numeric', 'between:-1000000,1000000'],
            'adjustment_reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'payment_option' => ['nullable', 'in:full,advance'],
            'mark_paid' => ['nullable', 'boolean'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'custom_payment_amount' => ['nullable', 'numeric', 'gt:0'],
            'booking_dates' => ['nullable', 'array', 'min:1', 'max:30'],
            'booking_dates.*.date' => ['required', 'date', 'after_or_equal:today', 'distinct'],
            'booking_dates.*.session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
        ]);

        $centre = $this->primaryCentre($request);
        abort_unless($centre, 400, 'No centre assigned to your account.');

        $booking = DB::transaction(function () use ($centre, $data, $request) {
            $booking = $this->bookings->create($centre, $data);
            $booking->update(['status' => 'payment_pending']);

            if ($request->boolean('mark_paid')) {
                $this->bookings->applyPayment(
                    $booking,
                    $data['payment_method'] ?? 'Cash',
                    $data['payment_option'] ?? 'full',
                    isset($data['custom_payment_amount']) ? (float) $data['custom_payment_amount'] : null
                );
            }

            return $booking->fresh();
        });

        return (new BookingResource($booking->fresh()->load('centre', 'payment', 'foodItems', 'bookingDates')))
            ->response()->setStatusCode(201);
    }

    public function updateBookingStatus(Request $request, string $bookingNo)
    {
        $data = $request->validate([
            'action' => ['required', 'in:confirm,complete,cancel'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $ids = $this->centres($request)->pluck('id');
        $booking = Booking::where('booking_no', $bookingNo)->whereIn('centre_id', $ids)->firstOrFail();

        if ($data['action'] === 'cancel') {
            $booking = $this->bookings->cancelAndRefund($booking, $data['reason'] ?? 'Cancelled by centre');
            \App\Services\Notify::send($booking->user_id, 'Booking cancelled',
                "Your booking {$booking->booking_no} was cancelled. Refund: {$booking->refunded_amount}.", 'booking', '/my-bookings');
        } else {
            $new = $data['action'] === 'confirm' ? 'confirmed' : 'completed';
            $booking->update(['status' => $new]);
            \App\Services\Notify::send($booking->user_id, 'Booking '.$new,
                "Your booking {$booking->booking_no} is now {$new}.", 'booking', '/my-bookings');
        }

        return new BookingResource($booking->load('centre', 'payment', 'foodItems', 'bookingDates'));
    }

    // ---- Food menus ----
    public function menus(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');

        return response()->json(['data' => FoodMenu::whereIn('centre_id', $ids)->latest()->get()]);
    }

    public function storeMenu(Request $request)
    {
        $data = $this->validateMenu($request);
        $data['centre_id'] = $this->ownCentreId($request, $request->input('centre_id', $this->primaryCentre($request)?->id));

        return response()->json(['data' => FoodMenu::create($data)], 201);
    }

    public function updateMenu(Request $request, FoodMenu $menu)
    {
        $this->ownCentreId($request, $menu->centre_id);
        $menu->update($this->validateMenu($request));

        return response()->json(['data' => $menu]);
    }

    public function deleteMenu(Request $request, FoodMenu $menu)
    {
        $this->ownCentreId($request, $menu->centre_id);
        $menu->delete();

        return response()->json(['message' => 'Menu removed.']);
    }

    protected function validateMenu(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'items' => ['nullable', 'string'],
            'menu_type' => ['nullable', 'string', 'max:100'],
            'price_per_person' => ['required', 'numeric', 'min:0'],
            'min_guest_count' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);
    }

    // ---- Availability ----
    public function availability(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        $from = $request->query('from', now()->toDateString());
        $to = $request->query('to', now()->addDays(60)->toDateString());

        $slots = AvailabilitySlot::whereIn('centre_id', $ids)
            ->whereBetween('date', [$from, $to])
            ->get()
            ->groupBy(fn ($s) => $s->date->format('Y-m-d'))
            ->map(fn ($day) => $day->mapWithKeys(fn ($s) => [$s->session_type => $s->status]));

        return response()->json(['data' => $slots]);
    }

    /** Block or unblock a date+session (never touches a 'booked' slot). */
    public function toggleBlock(Request $request)
    {
        $data = $request->validate([
            'date' => ['required', 'date'],
            'session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
            'block' => ['required', 'boolean'],
        ]);
        $centreId = $this->primaryCentre($request)?->id;
        abort_unless($centreId, 400, 'No centre found.');

        $slot = AvailabilitySlot::firstOrNew([
            'centre_id' => $centreId,
            'date' => $data['date'],
            'session_type' => $data['session_type'],
        ]);

        if ($slot->status === 'booked') {
            throw ValidationException::withMessages(['date' => 'This session is already booked and cannot be changed.']);
        }

        $slot->status = $data['block'] ? 'blocked' : 'available';
        $slot->save();

        return response()->json(['message' => 'Updated.', 'status' => $slot->status]);
    }

    // ---- Profile ----
    public function profile(Request $request)
    {
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 404, 'No centre assigned.');

        return response()->json(['data' => $centre->load('facilities', 'images')]);
    }

    /** Upload & set the centre cover photo. */
    public function uploadCover(Request $request)
    {
        $request->validate(['file' => ['required', 'image', 'max:5120']]);
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 404, 'No centre.');
        $url = Storage::url($request->file('file')->store('centres', 'public'));
        $centre->update(['cover_image' => $url]);

        return response()->json(['url' => $url]);
    }

    /** Upload & attach a gallery image. */
    public function addGalleryImage(Request $request)
    {
        $request->validate(['file' => ['required', 'image', 'max:5120']]);
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 404, 'No centre.');
        $url = Storage::url($request->file('file')->store('centres', 'public'));
        $image = $centre->images()->create(['image_path' => $url, 'type' => 'gallery', 'sort_order' => $centre->images()->count()]);

        return response()->json(['data' => $image], 201);
    }

    public function deleteGalleryImage(Request $request, CentreImage $image)
    {
        $ids = $this->centres($request)->pluck('id');
        abort_unless($ids->contains($image->centre_id), 403, 'Not your image.');
        $image->delete();

        return response()->json(['message' => 'Image removed.']);
    }

    /** Internal note on a booking (owner side). */
    public function updateBookingNote(Request $request, string $bookingNo)
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);
        $ids = $this->centres($request)->pluck('id');
        $booking = Booking::where('booking_no', $bookingNo)->whereIn('centre_id', $ids)->firstOrFail();
        $booking->update(['notes' => $data['notes']]);

        return response()->json(['message' => 'Note saved.', 'notes' => $booking->notes]);
    }

    public function updateProfile(Request $request)
    {
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 404, 'No centre assigned.');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'capacity' => ['sometimes', 'integer', 'min:0'],
            'half_day_price' => ['sometimes', 'numeric', 'min:0'],
            'full_day_price' => ['sometimes', 'numeric', 'min:0'],
            'virtual_tour_url' => ['nullable', 'url'],
        ]);

        $centre->update($data);

        return response()->json(['data' => $centre, 'message' => 'Profile updated.']);
    }

    /** Confirm a model belongs to one of the owner's centres. */
    protected function ownOrFail(Request $request, $model)
    {
        $ids = $this->centres($request)->pluck('id');
        abort_unless($ids->contains($model->centre_id), 403, 'Not your record.');

        return $model;
    }

    // ================= Inventory =================
    public function inventory(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        return response()->json(['data' => InventoryItem::whereIn('centre_id', $ids)->latest()->get()]);
    }

    public function storeInventory(Request $request)
    {
        $data = $this->validateInventory($request);
        $data['centre_id'] = $this->primaryCentre($request)?->id;
        $item = DB::transaction(function () use ($data, $request) {
            $item = InventoryItem::create($data);
            $opening = (float) $item->current_stock;
            if ($opening > 0) {
                $lot = null;
                if ($item->track_lots) {
                    $lot = InventoryLot::create([
                        'centre_id' => $item->centre_id, 'inventory_item_id' => $item->id,
                        'lot_no' => 'OPEN-'.$item->id.'-'.now()->format('ymd'),
                        'received_quantity' => $opening, 'available_quantity' => $opening,
                        'unit_cost' => (float) ($item->average_cost ?: $item->purchase_price), 'status' => 'active',
                    ]);
                }
                StockMovement::create([
                    'inventory_item_id' => $item->id, 'inventory_lot_id' => $lot?->id,
                    'movement_type' => 'in', 'quantity' => $opening, 'balance_after' => $opening,
                    'reason' => 'Opening balance', 'reference_type' => 'opening_balance',
                    'unit_cost' => (float) ($item->average_cost ?: $item->purchase_price), 'created_by' => $request->user()->id,
                ]);
            }
            return $item;
        });
        return response()->json(['data' => $item], 201);
    }

    public function updateInventory(Request $request, InventoryItem $item)
    {
        $this->ownOrFail($request, $item);
        $oldStock = (float) $item->current_stock;
        $item->update($this->validateInventory($request));
        $newStock = (float) $item->current_stock;
        if ($newStock !== $oldStock) {
            StockMovement::create([
                'inventory_item_id' => $item->id,
                'movement_type' => $newStock > $oldStock ? 'in' : 'adjust',
                'quantity' => abs($newStock - $oldStock), 'balance_after' => $newStock,
                'reason' => 'Product balance edited', 'reference_type' => 'manual_edit',
                'unit_cost' => $item->average_cost, 'created_by' => $request->user()->id,
            ]);
        }
        if ($item->current_stock <= $item->minimum_stock) {
            \App\Services\Notify::send($request->user()->id, 'Low stock alert',
                "{$item->name} is low ({$item->current_stock} {$item->unit} left).", 'inventory', '/owner/inventory');
        }
        return response()->json(['data' => $item]);
    }

    public function deleteInventory(Request $request, InventoryItem $item)
    {
        $this->ownOrFail($request, $item)->delete();
        return response()->json(['message' => 'Item removed.']);
    }

    /** Record a stock movement and adjust the item's balance. */
    public function adjustStock(Request $request, InventoryItem $item)
    {
        $this->ownOrFail($request, $item);
        $data = $request->validate([
            'movement_type' => ['required', 'in:in,out,return,adjust'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'reason' => ['nullable', 'string', 'max:255'],
            'inventory_lot_id' => ['nullable', 'integer'],
            'lot_no' => ['nullable', 'string', 'max:100'],
            'expires_at' => ['nullable', 'date'],
        ]);
        $movement = DB::transaction(function () use ($item, $data, $request) {
            $item = InventoryItem::whereKey($item->id)->lockForUpdate()->firstOrFail();
            $incoming = in_array($data['movement_type'], ['in', 'return'], true);
            $quantity = round((float) $data['quantity'], 2);
            $lot = null;

            if ($item->track_lots) {
                if (! empty($data['inventory_lot_id'])) {
                    $lot = InventoryLot::where('centre_id', $item->centre_id)->where('inventory_item_id', $item->id)
                        ->whereKey($data['inventory_lot_id'])->lockForUpdate()->firstOrFail();
                } elseif ($incoming && ! empty($data['lot_no'])) {
                    $lot = InventoryLot::where('inventory_item_id', $item->id)->where('lot_no', $data['lot_no'])->lockForUpdate()->first();
                    if (! $lot) {
                        $lot = InventoryLot::create([
                            'centre_id' => $item->centre_id, 'inventory_item_id' => $item->id,
                            'lot_no' => $data['lot_no'], 'unit_cost' => $item->average_cost,
                            'received_quantity' => 0, 'available_quantity' => 0,
                            'expires_at' => $data['expires_at'] ?? null, 'status' => 'active',
                        ]);
                    }
                } else {
                    throw ValidationException::withMessages(['inventory_lot_id' => $incoming
                        ? 'Select an existing lot or enter a new lot number.'
                        : 'Select the lot being issued or adjusted.']);
                }

                if ($incoming) {
                    $lot->increment('available_quantity', $quantity);
                    if ($data['movement_type'] === 'in') $lot->increment('received_quantity', $quantity);
                    $lot->update(['status' => 'active']);
                } else {
                    if ($quantity > (float) $lot->available_quantity) {
                        throw ValidationException::withMessages(['quantity' => 'Quantity exceeds the selected lot balance.']);
                    }
                    $lot->decrement('available_quantity', $quantity);
                    if ((float) $lot->fresh()->available_quantity <= 0) $lot->update(['status' => 'depleted']);
                }
            }

            $signed = $incoming ? $quantity : -$quantity;
            $balance = round((float) $item->current_stock + $signed, 2);
            if ($balance < 0) throw ValidationException::withMessages(['quantity' => 'Not enough stock for this movement.']);
            $item->update(['current_stock' => $balance]);

            return StockMovement::create([
                'inventory_item_id' => $item->id, 'inventory_lot_id' => $lot?->id,
                'movement_type' => $data['movement_type'], 'quantity' => $quantity,
                'balance_after' => $balance, 'reason' => $data['reason'] ?? null,
                'reference_type' => 'manual_movement', 'unit_cost' => $lot?->unit_cost ?? $item->average_cost,
                'created_by' => $request->user()->id,
            ]);
        });

        $item->refresh();

        if ($item->current_stock <= $item->minimum_stock) {
            \App\Services\Notify::send($request->user()->id, 'Low stock alert',
                "{$item->name} is low ({$item->current_stock} {$item->unit} left).", 'inventory', '/owner/inventory');
        }

        return response()->json(['data' => $movement, 'item' => $item, 'message' => 'Stock updated.']);
    }

    public function stockMovements(Request $request, InventoryItem $item)
    {
        $this->ownOrFail($request, $item);
        $rows = \App\Models\StockMovement::where('inventory_item_id', $item->id)->with('lot:id,lot_no')->latest()->limit(50)->get();

        return response()->json(['data' => $rows]);
    }

    protected function validateInventory(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
            'sku' => ['nullable', 'string', 'max:100'],
            'unit' => ['nullable', 'string', 'max:30'],
            'current_stock' => ['required', 'numeric', 'min:0'],
            'minimum_stock' => ['nullable', 'numeric', 'min:0'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'average_cost' => ['nullable', 'numeric', 'min:0'],
            'track_lots' => ['nullable', 'boolean'],
            'barcode' => ['nullable', 'string', 'max:100'],
            'brand' => ['nullable', 'string', 'max:100'],
            'storage_location' => ['nullable', 'string', 'max:100'],
            'condition' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);
    }

    // ================= HRM (employees + attendance) =================
    public function employees(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        $today = now()->toDateString();
        $employees = Employee::whereIn('centre_id', $ids)->latest()->get()->map(function ($e) use ($today) {
            $att = Attendance::where('employee_id', $e->id)->where('date', $today)->value('status');
            return array_merge($e->toArray(), ['today_attendance' => $att, 'has_login' => (bool) $e->user_id]);
        });
        return response()->json(['data' => $employees]);
    }

    public function storeEmployee(Request $request)
    {
        $data = $this->validateEmployee($request);
        $data['centre_id'] = $this->primaryCentre($request)?->id;
        $employee = Employee::create($data);
        $employee->update(['employee_code' => 'EMP-'.str_pad($employee->id, 4, '0', STR_PAD_LEFT)]);
        return response()->json(['data' => $employee], 201);
    }

    public function updateEmployee(Request $request, Employee $employee)
    {
        $this->ownOrFail($request, $employee)->update($this->validateEmployee($request));
        return response()->json(['data' => $employee]);
    }

    public function deleteEmployee(Request $request, Employee $employee)
    {
        $this->ownOrFail($request, $employee)->delete();
        return response()->json(['message' => 'Employee removed.']);
    }

    /** Create or reset a login for a staff member (their phone becomes the login id). */
    public function setEmployeeLogin(Request $request, Employee $employee)
    {
        $this->ownOrFail($request, $employee);
        $data = $request->validate(['password' => ['required', 'string', 'min:6']]);
        abort_unless($employee->phone, 422, 'Add a phone number to this staff member first.');

        // Reuse the linked user, otherwise find by phone, otherwise create new.
        $user = $employee->user_id ? User::find($employee->user_id) : User::where('phone', $employee->phone)->first();
        if ($user && $user->role !== 'staff') {
            abort(422, 'This phone number already belongs to another account.');
        }
        if (! $user) {
            $user = new User(['name' => $employee->name, 'phone' => $employee->phone, 'role' => 'staff', 'status' => 'active']);
        }
        $user->name = $employee->name;
        $user->password = Hash::make($data['password']);
        $user->api_token = $user->api_token ?: Str::random(72);
        $user->save();

        $employee->update(['user_id' => $user->id]);

        return response()->json(['message' => 'Staff login enabled.', 'login_phone' => $employee->phone]);
    }

    public function markAttendance(Request $request, Employee $employee)
    {
        $this->ownOrFail($request, $employee);
        $data = $request->validate([
            'status' => ['required', 'in:present,absent,leave,late'],
            'date' => ['nullable', 'date'],
        ]);
        $att = Attendance::updateOrCreate(
            ['employee_id' => $employee->id, 'date' => $data['date'] ?? now()->toDateString()],
            ['status' => $data['status']]
        );
        return response()->json(['data' => $att]);
    }

    protected function validateEmployee(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'designation' => ['nullable', 'string', 'max:100'],
            'salary' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:active,inactive,on_leave'],
            'joined_at' => ['nullable', 'date'],
        ]);
    }

    // ================= Expenses =================
    public function expenses(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        return response()->json(['data' => Expense::whereIn('centre_id', $ids)->latest()->get()]);
    }

    public function storeExpense(Request $request)
    {
        $data = $this->validateExpense($request);
        $data['centre_id'] = $this->primaryCentre($request)?->id;
        return response()->json(['data' => Expense::create($data)], 201);
    }

    public function updateExpense(Request $request, Expense $expense)
    {
        $this->ownOrFail($request, $expense)->update($this->validateExpense($request));
        return response()->json(['data' => $expense]);
    }

    public function deleteExpense(Request $request, Expense $expense)
    {
        $this->ownOrFail($request, $expense)->delete();
        return response()->json(['message' => 'Expense removed.']);
    }

    protected function validateExpense(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'reference_no' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:paid,pending'],
            'expense_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'bill_image' => ['nullable', 'string', 'max:500'],
        ]);
    }

    /** Generic image upload (bills, receipts). Returns a public URL. */
    public function upload(Request $request)
    {
        $request->validate(['file' => ['required', 'image', 'max:5120']]);
        $path = $request->file('file')->store('uploads', 'public');

        return response()->json(['url' => Storage::url($path), 'path' => $path]);
    }

    // ================= Payroll / salary disbursement =================
    public function payroll(Request $request)
    {
        $month = $request->query('month', now()->format('Y-m'));
        $ids = $this->centres($request)->pluck('id');

        $rows = Payroll::whereIn('centre_id', $ids)->where('month', $month)
            ->with('employee:id,name,designation')->get()
            ->map(fn ($p) => array_merge($p->toArray(), [
                'employee_name' => $p->employee?->name,
                'designation' => $p->employee?->designation,
            ]));

        return response()->json([
            'month' => $month,
            'data' => $rows,
            'summary' => [
                'total' => (float) $rows->sum('net_salary'),
                'paid' => (float) $rows->where('status', 'paid')->sum('net_salary'),
                'pending' => (float) $rows->where('status', 'pending')->sum('net_salary'),
                'headcount' => $rows->count(),
            ],
        ]);
    }

    /** Generate (or refresh pending) payroll for a month from active staff + attendance. */
    public function generatePayroll(Request $request)
    {
        $data = $request->validate(['month' => ['required', 'regex:/^\d{4}-\d{2}$/']]);
        $month = $data['month'];
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 400, 'No centre.');

        $start = $month.'-01';
        $end = date('Y-m-t', strtotime($start));

        $created = 0;
        foreach (Employee::where('centre_id', $centre->id)->where('status', '!=', 'inactive')->get() as $emp) {
            $present = Attendance::where('employee_id', $emp->id)->whereBetween('date', [$start, $end])->where('status', 'present')->count();
            $absent = Attendance::where('employee_id', $emp->id)->whereBetween('date', [$start, $end])->where('status', 'absent')->count();
            $perDay = $emp->salary / 30;
            $deduction = round($perDay * $absent, 2);

            $existing = Payroll::where('employee_id', $emp->id)->where('month', $month)->first();
            if ($existing && $existing->status === 'paid') {
                continue; // never touch a disbursed payslip
            }
            Payroll::updateOrCreate(
                ['employee_id' => $emp->id, 'month' => $month],
                [
                    'centre_id' => $centre->id,
                    'basic_salary' => $emp->salary,
                    'bonus' => $existing->bonus ?? 0,
                    'deduction' => $deduction,
                    'present_days' => $present,
                    'absent_days' => $absent,
                    'net_salary' => round($emp->salary + ($existing->bonus ?? 0) - $deduction, 2),
                    'status' => 'pending',
                ]
            );
            $created++;
        }

        return response()->json(['message' => "Payroll generated for {$created} staff.", 'count' => $created]);
    }

    public function updatePayroll(Request $request, Payroll $payroll)
    {
        $this->ownOrFail($request, $payroll);
        abort_if($payroll->status === 'paid', 422, 'This payslip is already paid.');
        $data = $request->validate([
            'bonus' => ['nullable', 'numeric', 'min:0'],
            'deduction' => ['nullable', 'numeric', 'min:0'],
        ]);
        $bonus = $data['bonus'] ?? $payroll->bonus;
        $deduction = $data['deduction'] ?? $payroll->deduction;
        $payroll->update([
            'bonus' => $bonus,
            'deduction' => $deduction,
            'net_salary' => round($payroll->basic_salary + $bonus - $deduction, 2),
        ]);

        return response()->json(['data' => $payroll]);
    }

    public function payPayroll(Request $request, Payroll $payroll)
    {
        $this->ownOrFail($request, $payroll);
        $method = $request->input('payment_method', 'Bank Transfer');
        $payroll->update(['status' => 'paid', 'payment_method' => $method, 'paid_at' => now()]);

        $emp = Employee::find($payroll->employee_id);
        \App\Services\Notify::send($emp?->user_id, 'Salary disbursed',
            "Your salary for {$payroll->month} ({$payroll->net_salary}) has been paid via {$method}.", 'payroll', '/staff');

        return response()->json(['data' => $payroll, 'message' => 'Salary disbursed.']);
    }

    public function disburseAll(Request $request)
    {
        $data = $request->validate(['month' => ['required', 'regex:/^\d{4}-\d{2}$/']]);
        $ids = $this->centres($request)->pluck('id');
        $method = $request->input('payment_method', 'Bank Transfer');
        $count = Payroll::whereIn('centre_id', $ids)->where('month', $data['month'])->where('status', 'pending')
            ->update(['status' => 'paid', 'payment_method' => $method, 'paid_at' => now()]);

        return response()->json(['message' => "Disbursed {$count} salaries.", 'count' => $count]);
    }

    // ================= Accounting (P&L + ledger) =================
    public function accounting(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        $paid = ['paid', 'confirmed', 'completed'];

        $income = Booking::whereIn('centre_id', $ids)->whereIn('status', $paid)->get(['booking_no', 'paid_amount', 'event_date', 'created_at', 'customer_name']);
        $expenses = Expense::whereIn('centre_id', $ids)->get();
        $payrolls = Payroll::whereIn('centre_id', $ids)->where('status', 'paid')->with('employee:id,name')->get();

        $ledger = collect();
        foreach ($income as $b) {
            $ledger->push(['date' => optional($b->created_at)->toDateString(), 'type' => 'income', 'category' => 'Booking', 'ref' => $b->booking_no, 'desc' => $b->customer_name, 'amount' => (float) $b->paid_amount]);
        }
        foreach ($expenses->where('status', 'paid') as $e) {
            $ledger->push(['date' => $e->expense_date, 'type' => 'expense', 'category' => $e->category, 'ref' => $e->reference_no, 'desc' => $e->title.($e->vendor ? " · {$e->vendor}" : ''), 'amount' => (float) $e->amount]);
        }
        foreach ($payrolls as $p) {
            $ledger->push(['date' => optional($p->paid_at)->toDateString(), 'type' => 'expense', 'category' => 'Payroll', 'ref' => $p->month, 'desc' => 'Salary · '.($p->employee?->name ?? ''), 'amount' => (float) $p->net_salary]);
        }

        $totalIncome = (float) $income->sum('paid_amount');
        $expensePaid = (float) $expenses->where('status', 'paid')->sum('amount');
        $payrollPaid = (float) $payrolls->sum('net_salary');
        $totalExpense = $expensePaid + $payrollPaid;

        // category breakdown for expenses + payroll
        $byCategory = $expenses->where('status', 'paid')->groupBy('category')->map(fn ($g) => (float) $g->sum('amount'));
        if ($payrollPaid > 0) {
            $byCategory['Payroll'] = ($byCategory['Payroll'] ?? 0) + $payrollPaid;
        }

        $settlements = Settlement::whereIn('centre_id', $ids)
            ->withCount('items')
            ->latest()
            ->limit(24)
            ->get();

        return response()->json([
            'summary' => [
                'income' => $totalIncome,
                'expense' => $totalExpense,
                'net_profit' => round($totalIncome - $totalExpense, 2),
                'expense_pending' => (float) $expenses->where('status', 'pending')->sum('amount'),
                'payroll_pending' => (float) Payroll::whereIn('centre_id', $ids)->where('status', 'pending')->sum('net_salary'),
                'margin' => $totalIncome > 0 ? round(($totalIncome - $totalExpense) / $totalIncome * 100) : 0,
                'settlement_payable' => (float) $settlements->whereIn('status', ['pending', 'approved'])->sum('net_amount'),
                'settlement_paid' => (float) $settlements->where('status', 'paid')->sum('net_amount'),
            ],
            'by_category' => $byCategory->map(fn ($v, $k) => ['category' => $k ?: 'Other', 'amount' => $v])->values(),
            'ledger' => $ledger->sortByDesc('date')->take(60)->values(),
            'settlements' => $settlements,
        ]);
    }

    // ================= Zero Waste =================
    public function wasteStreams(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        return response()->json(['data' => WasteStream::whereIn('centre_id', $ids)->latest()->get()]);
    }

    public function storeWaste(Request $request)
    {
        $data = $this->validateWaste($request);
        $data['centre_id'] = $this->primaryCentre($request)?->id;
        return response()->json(['data' => WasteStream::create($data)], 201);
    }

    public function updateWaste(Request $request, WasteStream $waste)
    {
        $this->ownOrFail($request, $waste)->update($this->validateWaste($request));
        return response()->json(['data' => $waste]);
    }

    public function deleteWaste(Request $request, WasteStream $waste)
    {
        $this->ownOrFail($request, $waste)->delete();
        return response()->json(['message' => 'Waste stream removed.']);
    }

    /** List verified zero-waste partners the owner can assign to. */
    public function wastePartners()
    {
        $partners = User::where('role', 'waste_partner')->where('status', 'active')
            ->get(['id', 'name', 'phone']);

        return response()->json(['data' => $partners]);
    }

    /** Assign a waste stream to a specific partner. */
    public function assignWaste(Request $request, WasteStream $waste)
    {
        $this->ownOrFail($request, $waste);
        $data = $request->validate([
            'partner_id' => ['required', 'exists:users,id'],
            'pickup_scheduled_for' => ['nullable', 'date'],
        ]);
        $partner = User::where('id', $data['partner_id'])->where('role', 'waste_partner')->firstOrFail();

        $waste->update([
            'assigned_partner_id' => $partner->id,
            'status' => 'pickup_assigned',
            'pickup_scheduled_for' => $data['pickup_scheduled_for'] ?? $waste->pickup_scheduled_for,
        ]);

        \App\Services\Notify::send($partner->id, 'New pickup assigned',
            "{$waste->waste_type} ({$waste->quantity}{$waste->unit}) at {$waste->centre?->name}.", 'waste', '/partner/pickups');

        return response()->json(['data' => $waste, 'message' => "Assigned to {$partner->name}."]);
    }

    protected function validateWaste(Request $request): array
    {
        return $request->validate([
            'waste_type' => ['required', 'string', 'max:100'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:20'],
            'status' => ['nullable', 'in:sorting_required,compost_pending,recycling_assigned,pickup_assigned,collected,recycled,composted,returned_to_inventory,disposed_safely'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    // ================= Reports =================
    public function reports(Request $request)
    {
        $ids = $this->centres($request)->pluck('id');
        $paid = ['paid', 'confirmed', 'completed'];

        $recycled = (float) WasteStream::whereIn('centre_id', $ids)->whereIn('status', ['recycled', 'composted', 'returned_to_inventory'])->sum('quantity');
        $totalWaste = (float) WasteStream::whereIn('centre_id', $ids)->sum('quantity');

        return response()->json([
            'revenue' => (float) Booking::whereIn('centre_id', $ids)->whereIn('status', $paid)->sum('paid_amount'),
            'bookings' => Booking::whereIn('centre_id', $ids)->count(),
            'expenses_paid' => (float) Expense::whereIn('centre_id', $ids)->where('status', 'paid')->sum('amount'),
            'expenses_pending' => (float) Expense::whereIn('centre_id', $ids)->where('status', 'pending')->sum('amount'),
            'payroll' => (float) Employee::whereIn('centre_id', $ids)->where('status', 'active')->sum('salary'),
            'staff' => Employee::whereIn('centre_id', $ids)->count(),
            'low_stock' => InventoryItem::whereIn('centre_id', $ids)->whereColumn('current_stock', '<=', 'minimum_stock')->count(),
            'inventory_items' => InventoryItem::whereIn('centre_id', $ids)->count(),
            'waste_total' => $totalWaste,
            'waste_diverted' => $recycled,
            'diversion_rate' => $totalWaste > 0 ? round($recycled / $totalWaste * 100) : 0,
        ]);
    }
}
