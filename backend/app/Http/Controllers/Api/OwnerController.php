<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\AppSetting;
use App\Models\Attendance;
use App\Models\AvailabilitySlot;
use App\Models\Booking;
use App\Models\CentreFacility;
use App\Models\CentreFloor;
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
use App\Support\HtmlSanitizer;
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
                'vat' => (float) Booking::whereIn('centre_id', $ids)->whereIn('status', $paid)->sum('vat_amount'),
                'service_charge' => (float) Booking::whereIn('centre_id', $ids)->whereIn('status', $paid)->sum('service_charge'),
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

    /** Owner edits a booking's customer/event details and price adjustment. */
    public function updateBooking(Request $request, string $bookingNo)
    {
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'guest_count' => ['required', 'integer', 'min:1'],
            'event_type' => ['nullable', 'string', 'max:255'],
            'adjustment_amount' => ['nullable', 'numeric', 'between:-1000000,1000000'],
            'adjustment_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $ids = $this->centres($request)->pluck('id');
        $booking = Booking::where('booking_no', $bookingNo)->whereIn('centre_id', $ids)->firstOrFail();

        abort_if(in_array($booking->status, ['cancelled', 'completed', 'refunded'], true), 422, 'This booking can no longer be edited.');

        // Recompute the total from the fixed line items plus the (possibly negative) adjustment.
        $adjustment = round((float) ($data['adjustment_amount'] ?? 0), 2);
        $base = (float) $booking->venue_amount + (float) $booking->food_amount
            + (float) $booking->service_charge + (float) $booking->vat_amount;
        $total = round($base + $adjustment, 2);
        $due = max(round($total - (float) $booking->paid_amount, 2), 0);

        $booking->update([
            'customer_name' => $data['customer_name'],
            'customer_phone' => $data['customer_phone'],
            'customer_email' => $data['customer_email'] ?? null,
            'guest_count' => $data['guest_count'],
            'event_type' => $data['event_type'] ?? null,
            'adjustment_amount' => $adjustment,
            'adjustment_reason' => $data['adjustment_reason'] ?? null,
            'total_amount' => $total,
            'due_amount' => $due,
        ]);

        return new BookingResource($booking->fresh()->load('centre', 'payment', 'foodItems', 'bookingDates'));
    }

    /** Attach/replace image attachments (and optionally notes) on a booking. */
    public function updateBookingAttachments(Request $request, string $bookingNo)
    {
        $data = $request->validate([
            'attachments' => ['present', 'array', 'max:20'],
            'attachments.*' => ['string', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $ids = $this->centres($request)->pluck('id');
        $booking = Booking::where('booking_no', $bookingNo)->whereIn('centre_id', $ids)->firstOrFail();

        $booking->update([
            'attachments' => array_values($data['attachments']),
            ...($request->has('notes') ? ['notes' => $data['notes']] : []),
        ]);

        return new BookingResource($booking->fresh()->load('centre', 'payment', 'foodItems', 'bookingDates'));
    }

    /** Issue a full or partial refund on a booking. */
    public function refundBooking(Request $request, string $bookingNo)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $ids = $this->centres($request)->pluck('id');
        $booking = Booking::where('booking_no', $bookingNo)->whereIn('centre_id', $ids)->with('payment')->firstOrFail();

        $booking = $this->bookings->refund($booking, (float) $data['amount'], $data['reason'] ?? null);

        \App\Services\Notify::send($booking->user_id, 'Refund issued',
            "A refund of {$data['amount']} was issued for booking {$booking->booking_no}.", 'payment', '/my-bookings');

        return new BookingResource($booking->load('centre', 'payment', 'foodItems', 'bookingDates'));
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
            ->where('centre_floor_id', $request->query('floor_id') ?: null)
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
            'floor_id' => ['nullable', 'integer', 'exists:centre_floors,id'],
        ]);
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 400, 'No centre found.');
        $centreId = $centre->id;

        // Blocking is per-floor when the venue books by floor.
        $floorId = ! empty($data['floor_id'])
            ? $centre->floors()->whereKey($data['floor_id'])->value('id')
            : null;
        abort_if(! empty($data['floor_id']) && ! $floorId, 422, 'That floor is not part of this centre.');

        $slot = AvailabilitySlot::firstOrNew([
            'centre_id' => $centreId,
            'centre_floor_id' => $floorId,
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
            'area' => ['sometimes', 'string', 'max:120'],
            'address' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'capacity' => ['sometimes', 'integer', 'min:0'],
            'base_price' => ['sometimes', 'numeric', 'min:0'],
            'half_day_price' => ['sometimes', 'numeric', 'min:0'],
            'full_day_price' => ['sometimes', 'numeric', 'min:0'],
            'virtual_tour_url' => ['nullable', 'url'],
            'booking_prefix' => ['sometimes', 'nullable', 'string', 'regex:/^[A-Za-z0-9]{2,12}$/'],
        ], [
            'booking_prefix.regex' => 'Prefix must be 2–12 letters or numbers, no spaces.',
        ]);

        if (isset($data['booking_prefix'])) {
            $data['booking_prefix'] = strtoupper($data['booking_prefix']);
        }

        // Description is rich text from the WYSIWYG editor — allowlist it.
        if (array_key_exists('description', $data)) {
            $data['description'] = HtmlSanitizer::clean($data['description']);
        }

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

    // ================= Centre facilities (amenities) =================

    public function storeFacility(Request $request)
    {
        $centre = $this->primaryCentre($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
        ]);
        $facility = $centre->facilities()->create($data);
        return response()->json(['data' => $facility], 201);
    }

    public function updateFacility(Request $request, CentreFacility $facility)
    {
        $this->ownOrFail($request, $facility);
        $facility->update($request->validate([
            'name' => ['required', 'string', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
        ]));
        return response()->json(['data' => $facility]);
    }

    public function deleteFacility(Request $request, CentreFacility $facility)
    {
        $this->ownOrFail($request, $facility)->delete();
        return response()->json(['message' => 'Facility removed.']);
    }

    // ================= Centre floors =================

    public function floors(Request $request)
    {
        $centre = $this->primaryCentre($request);
        return response()->json(['data' => $centre->floors()->get()]);
    }

    public function storeFloor(Request $request)
    {
        $centre = $this->primaryCentre($request);
        $floor = $centre->floors()->create($this->validateFloor($request));
        return response()->json(['data' => $floor], 201);
    }

    public function updateFloor(Request $request, CentreFloor $floor)
    {
        $this->ownOrFail($request, $floor);
        $floor->update($this->validateFloor($request));
        return response()->json(['data' => $floor]);
    }

    public function deleteFloor(Request $request, CentreFloor $floor)
    {
        $this->ownOrFail($request, $floor);
        abort_if($floor->bookings()->exists(), 422, 'This floor has bookings and cannot be deleted. Set it to inactive instead.');
        $floor->delete();
        return response()->json(['message' => 'Floor removed.']);
    }

    protected function validateFloor(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
            'capacity' => ['nullable', 'integer', 'min:0'],
            'half_day_price' => ['nullable', 'numeric', 'min:0'],
            'full_day_price' => ['nullable', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);
    }

    /** Product columns that have managed (dynamic) lists. */
    protected array $taxonomyTypes = ['category', 'brand', 'unit', 'storage_location'];

    /** Return saved (managed) category / brand / unit / storage-location lists. */
    public function inventoryTaxonomy(Request $request)
    {
        $id = $this->primaryCentre($request)?->id;
        return response()->json(collect($this->taxonomyTypes)
            ->mapWithKeys(fn ($t) => [$t.'s' => $this->taxonomyList($id, $t)]));
    }

    /** Add a value to a managed list. */
    public function storeInventoryTaxonomy(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'in:'.implode(',', $this->taxonomyTypes)],
            'name' => ['required', 'string', 'max:100'],
        ]);
        $id = $this->primaryCentre($request)?->id;
        $this->registerTaxonomy($id, [$data['type'] => $data['name']]);
        return response()->json(['data' => $this->taxonomyList($id, $data['type'])]);
    }

    /** Rename a value in a managed list, updating any products that use it. */
    public function updateInventoryTaxonomy(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'in:'.implode(',', $this->taxonomyTypes)],
            'name' => ['required', 'string', 'max:100'],
            'new_name' => ['required', 'string', 'max:100'],
        ]);
        $id = $this->primaryCentre($request)?->id;
        $type = $data['type'];
        $new = trim($data['new_name']);
        // Rewrite the saved list: drop the old name, add the new one.
        $list = collect($this->taxonomyList($id, $type))
            ->reject(fn ($v) => mb_strtolower($v) === mb_strtolower($data['name']))
            ->push($new)->map(fn ($v) => trim($v))->filter()
            ->unique(fn ($v) => mb_strtolower($v))->sort(SORT_NATURAL | SORT_FLAG_CASE)->values();
        AppSetting::put("inv_{$type}s:{$id}", $list->toJson());
        // Keep products in sync with the rename.
        InventoryItem::where('centre_id', $id)->where($type, $data['name'])->update([$type => $new]);
        return response()->json(['data' => $list->all()]);
    }

    /** Remove a value from a managed list. Blocked while products still use it. */
    public function deleteInventoryTaxonomy(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'in:'.implode(',', $this->taxonomyTypes)],
            'name' => ['required', 'string', 'max:100'],
        ]);
        $id = $this->primaryCentre($request)?->id;
        $inUse = InventoryItem::where('centre_id', $id)->where($data['type'], $data['name'])->count();
        abort_if($inUse > 0, 422, "Cannot delete — {$inUse} product(s) still use this. Reassign them first.");
        $list = collect($this->taxonomyList($id, $data['type']))
            ->reject(fn ($v) => mb_strtolower($v) === mb_strtolower($data['name']))->values();
        AppSetting::put("inv_{$data['type']}s:{$id}", $list->toJson());
        return response()->json(['data' => $list->all()]);
    }

    protected function taxonomyList($centreId, string $type): array
    {
        $saved = json_decode(AppSetting::get("inv_{$type}s:{$centreId}", '[]'), true) ?: [];
        $used = InventoryItem::where('centre_id', $centreId)->pluck($type)->filter()->all();
        return collect($saved)->merge($used)->map(fn ($v) => trim((string) $v))->filter()
            ->unique(fn ($v) => mb_strtolower($v))->sort(SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
    }

    /** Register one or more values, keyed by type, into their managed lists. */
    protected function registerTaxonomy($centreId, array $values): void
    {
        if (! $centreId) return;
        foreach ($values as $type => $value) {
            if (! in_array($type, $this->taxonomyTypes, true)) continue;
            $value = trim((string) $value);
            if ($value === '') continue;
            $key = "inv_{$type}s:{$centreId}";
            $saved = json_decode(AppSetting::get($key, '[]'), true) ?: [];
            if (! collect($saved)->contains(fn ($v) => mb_strtolower($v) === mb_strtolower($value))) {
                $saved[] = $value;
                AppSetting::put($key, json_encode(array_values($saved)));
            }
        }
    }

    public function storeInventory(Request $request)
    {
        $data = $this->validateInventory($request);
        $data['centre_id'] = $this->primaryCentre($request)?->id;
        $this->registerTaxonomy($data['centre_id'], $data);
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
        $data = $this->validateInventory($request);
        $this->registerTaxonomy($item->centre_id, $data);
        $item->update($data);
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
            'image' => ['nullable', 'string', 'max:2048'],
            'category' => ['nullable', 'string', 'max:100'],
            'product_type' => ['nullable', 'in:physical,perishable'],
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
            $att = Attendance::where('employee_id', $e->id)->where('date', $today)->first();
            return array_merge($e->toArray(), [
                'today_attendance' => $att?->status,
                'today_check_in' => $att?->check_in_at ? \Illuminate\Support\Carbon::parse($att->check_in_at)->format('h:i A') : null,
                'has_login' => (bool) $e->user_id,
            ]);
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

    /** Scan an uploaded NID/ID image and return extracted fields to auto-fill the staff form. */
    public function scanNid(Request $request, \App\Services\NidScanner $scanner)
    {
        $request->validate(['file' => ['required', 'file', 'max:8192', 'mimes:jpg,jpeg,png,webp,pdf']]);

        return response()->json(['data' => $scanner->extract($request->file('file'))]);
    }

    /** Per-centre HR configuration (owner-level defaults for their staff). */
    public function hrSettings(Request $request)
    {
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 404, 'No centre assigned.');

        return response()->json(['data' => [
            'hr_late_cutoff' => $centre->hr_late_cutoff,
            'hr_absence_deduction_rate' => $centre->hr_absence_deduction_rate,
            'hr_leave_deduction_rate' => $centre->hr_leave_deduction_rate,
            'hr_late_penalty' => $centre->hr_late_penalty,
            'hr_standard_hours' => (float) ($centre->hr_standard_hours ?? 8),
            'hr_weekly_off' => $centre->hr_weekly_off,
        ], 'global' => [
            'absence_deduction_rate' => (float) AppSetting::get('absence_deduction_rate', 1.0),
            'leave_deduction_rate' => (float) AppSetting::get('leave_deduction_rate', 0),
            'late_penalty' => (float) AppSetting::get('late_penalty', 0),
            'late_cutoff' => AppSetting::get('late_cutoff', '10:00'),
        ]]);
    }

    public function updateHrSettings(Request $request)
    {
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 404, 'No centre assigned.');

        $data = $request->validate([
            'hr_late_cutoff' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'hr_absence_deduction_rate' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'hr_leave_deduction_rate' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'hr_late_penalty' => ['nullable', 'numeric', 'min:0'],
            'hr_standard_hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
            'hr_weekly_off' => ['nullable', 'string', 'max:20'],
        ]);

        $centre->update($data);

        return response()->json(['message' => 'HR settings saved.']);
    }

    /** Owner opens (impersonates) one of their staff member's portal account. */
    public function impersonateStaff(Request $request, Employee $employee)
    {
        $this->ownOrFail($request, $employee);
        abort_unless($employee->user_id, 422, 'Enable a login for this staff member first.');

        $user = User::findOrFail($employee->user_id);
        abort_unless($user->role === 'staff', 422, 'This account is not a staff login.');
        $user->update(['api_token' => Str::random(72)]);

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'phone' => $user->phone, 'email' => $user->email, 'role' => $user->role],
            'token' => $user->api_token,
        ]);
    }

    /**
     * Daily attendance report for the owner's centre: a full roster for one day
     * (including staff nobody marked), each row scored against that employee's
     * own late cutoff, plus a 7-day trend ending on the reported date.
     */
    public function attendanceReport(Request $request)
    {
        $data = $request->validate(['date' => ['nullable', 'date']]);
        $date = $data['date'] ?? now()->toDateString();

        $centre = $this->primaryCentre($request);
        abort_unless($centre, 400, 'No centre assigned to your account.');

        $globalCutoff = AppSetting::get('late_cutoff', '10:00');
        $centreCutoff = $centre->hr_late_cutoff ?: $globalCutoff;

        $employees = Employee::where('centre_id', $centre->id)
            ->where('status', 'active')
            ->orderBy('name')
            ->get();

        $marks = Attendance::whereIn('employee_id', $employees->pluck('id'))
            ->whereDate('date', $date)
            ->get()
            ->keyBy('employee_id');

        $rows = $employees->map(function (Employee $employee) use ($marks, $centreCutoff, $date) {
            $mark = $marks->get($employee->id);
            $cutoff = $employee->late_after ?: $centreCutoff;

            $lateBy = 0;
            if ($mark?->check_in_at) {
                $due = \Illuminate\Support\Carbon::parse("{$date} {$cutoff}");
                $lateBy = max((int) round($due->diffInMinutes($mark->check_in_at, false)), 0);
            }

            return [
                'employee_id' => $employee->id,
                'employee_code' => $employee->employee_code,
                'name' => $employee->name,
                'designation' => $employee->designation,
                'employment_type' => $employee->employment_type ?? 'monthly',
                'status' => $mark?->status,                 // null = nobody marked them
                'check_in_at' => $mark?->check_in_at?->format('H:i'),
                'late_by_minutes' => $lateBy,
                'cutoff' => $cutoff,
                'logged_by' => $mark?->logged_by,
            ];
        })->values();

        $count = fn (string $status) => $rows->where('status', $status)->count();
        $total = $rows->count();
        $presentish = $count('present') + $count('late');

        // 7-day trend ending on the reported date.
        $from = \Illuminate\Support\Carbon::parse($date)->subDays(6)->toDateString();
        $history = Attendance::whereIn('employee_id', $employees->pluck('id'))
            ->whereBetween('date', [$from, $date])
            ->get()
            ->groupBy(fn ($a) => $a->date->format('Y-m-d'));

        $trend = collect(range(6, 0))->map(function ($back) use ($date, $history, $total) {
            $day = \Illuminate\Support\Carbon::parse($date)->subDays($back)->toDateString();
            $rows = $history->get($day, collect());
            return [
                'date' => $day,
                'present' => $rows->where('status', 'present')->count(),
                'late' => $rows->where('status', 'late')->count(),
                'absent' => $rows->where('status', 'absent')->count(),
                'leave' => $rows->where('status', 'leave')->count(),
                'not_marked' => max($total - $rows->count(), 0),
            ];
        })->values();

        return response()->json(['data' => [
            'date' => $date,
            'centre' => $centre->only(['id', 'name']),
            'default_cutoff' => $centreCutoff,
            'summary' => [
                'total' => $total,
                'present' => $count('present'),
                'late' => $count('late'),
                'absent' => $count('absent'),
                'leave' => $count('leave'),
                'not_marked' => $rows->whereNull('status')->count(),
                'attendance_rate' => $total ? round($presentish / $total * 100, 1) : 0.0,
                'total_late_minutes' => (int) $rows->sum('late_by_minutes'),
            ],
            'rows' => $rows,
            'trend' => $trend,
        ]]);
    }

    public function markAttendance(Request $request, Employee $employee)
    {
        $this->ownOrFail($request, $employee);
        $data = $request->validate([
            'status' => ['required', 'in:present,absent,leave,late'],
            'date' => ['nullable', 'date'],
            'check_in_at' => ['nullable', 'date'],
        ]);
        $present = in_array($data['status'], ['present', 'late'], true);
        $att = Attendance::updateOrCreate(
            ['employee_id' => $employee->id, 'date' => $data['date'] ?? now()->toDateString()],
            [
                'status' => $data['status'],
                'check_in_at' => $present ? ($data['check_in_at'] ?? now()) : null,
                'logged_by' => $request->user()->role === 'admin' ? 'admin' : 'owner',
            ]
        );
        return response()->json(['data' => $att]);
    }

    protected function validateEmployee(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'designation' => ['nullable', 'string', 'max:100'],
            'employment_type' => ['nullable', 'in:monthly,hourly'],
            'salary' => ['nullable', 'numeric', 'min:0'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:active,inactive,on_leave'],
            'joined_at' => ['nullable', 'date'],
            // Per-employee payroll/attendance overrides (blank = inherit global rule)
            'absence_deduction_rate' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'leave_deduction_rate' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'late_penalty' => ['nullable', 'numeric', 'min:0'],
            'late_after' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'standard_hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
            'weekly_off' => ['nullable', 'string', 'max:20'],
            // Personal / identity
            'photo' => ['nullable', 'string', 'max:2048'],
            'nid' => ['nullable', 'string', 'max:50'],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:500'],
            // Nominee
            'nominee_name' => ['nullable', 'string', 'max:255'],
            'nominee_relation' => ['nullable', 'string', 'max:100'],
            'nominee_phone' => ['nullable', 'string', 'max:30'],
            'nominee_nid' => ['nullable', 'string', 'max:50'],
            // Documents
            'documents' => ['nullable', 'array', 'max:30'],
            'documents.*.name' => ['required', 'string', 'max:120'],
            'documents.*.url' => ['required', 'string', 'max:2048'],
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
            ->with('employee:id,name,designation,employment_type,hourly_rate')->get()
            ->map(fn ($p) => array_merge($p->toArray(), [
                'employee_name' => $p->employee?->name,
                'designation' => $p->employee?->designation,
                'employment_type' => $p->employee?->employment_type ?? 'monthly',
                'hourly_rate' => (float) ($p->employee?->hourly_rate ?? 0),
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

        // Resolution order for each rule: employee → centre → global admin default.
        $gAbsenceRate = (float) AppSetting::get('absence_deduction_rate', 1.0);
        $gLeaveRate = (float) AppSetting::get('leave_deduction_rate', 0);
        $gLatePenalty = (float) AppSetting::get('late_penalty', 0);
        $cAbsenceRate = $centre->hr_absence_deduction_rate ?? $gAbsenceRate;
        $cLeaveRate = $centre->hr_leave_deduction_rate ?? $gLeaveRate;
        $cLatePenalty = $centre->hr_late_penalty ?? $gLatePenalty;
        $standardHours = (float) ($centre->hr_standard_hours ?? 8);

        $created = 0;
        foreach (Employee::where('centre_id', $centre->id)->where('status', '!=', 'inactive')->get() as $emp) {
            // Per-employee overrides fall back to centre, then global.
            $absenceRate = $emp->absence_deduction_rate ?? $cAbsenceRate;
            $leaveRate = $emp->leave_deduction_rate ?? $cLeaveRate;
            $latePenalty = $emp->late_penalty ?? $cLatePenalty;
            $empHours = $emp->standard_hours ?? $standardHours;
            $present = Attendance::where('employee_id', $emp->id)->whereBetween('date', [$start, $end])->where('status', 'present')->count();
            $absent = Attendance::where('employee_id', $emp->id)->whereBetween('date', [$start, $end])->where('status', 'absent')->count();
            $leave = Attendance::where('employee_id', $emp->id)->whereBetween('date', [$start, $end])->where('status', 'leave')->count();
            $lateDays = Attendance::where('employee_id', $emp->id)->whereBetween('date', [$start, $end])->where('status', 'late')->count();

            $existing = Payroll::where('employee_id', $emp->id)->where('month', $month)->first();
            if ($existing && $existing->status === 'paid') {
                continue; // never touch a disbursed payslip
            }

            if ($emp->employment_type === 'hourly') {
                // Contractual staff are paid per hour worked (default 8h per present day).
                $hours = $existing->hours_worked ?? ($present * $empHours);
                $basic = round((float) $emp->hourly_rate * $hours, 2);
                $deduction = round($latePenalty * $lateDays, 2);
            } else {
                $hours = 0;
                $basic = (float) $emp->salary;
                $perDay = $emp->salary / 30;
                $deduction = round(($perDay * $absent * $absenceRate) + ($perDay * $leave * $leaveRate) + ($latePenalty * $lateDays), 2);
            }

            Payroll::updateOrCreate(
                ['employee_id' => $emp->id, 'month' => $month],
                [
                    'centre_id' => $centre->id,
                    'basic_salary' => $basic,
                    'bonus' => $existing->bonus ?? 0,
                    'deduction' => $deduction,
                    'present_days' => $present,
                    'absent_days' => $absent,
                    'hours_worked' => $hours,
                    'net_salary' => round($basic + ($existing->bonus ?? 0) - $deduction, 2),
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
            'hours_worked' => ['nullable', 'numeric', 'min:0'],
        ]);
        $bonus = $data['bonus'] ?? $payroll->bonus;
        $deduction = $data['deduction'] ?? $payroll->deduction;

        $basic = $payroll->basic_salary;
        $hours = $payroll->hours_worked;
        // Hourly staff: editing hours recomputes the basic from the employee's rate.
        if (array_key_exists('hours_worked', $data) && $payroll->employee?->employment_type === 'hourly') {
            $hours = round((float) $data['hours_worked'], 2);
            $basic = round((float) $payroll->employee->hourly_rate * $hours, 2);
        }

        $payroll->update([
            'bonus' => $bonus,
            'deduction' => $deduction,
            'hours_worked' => $hours,
            'basic_salary' => $basic,
            'net_salary' => round($basic + $bonus - $deduction, 2),
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
        $manual = \App\Models\LedgerEntry::whereIn('centre_id', $ids)->get();

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
        foreach ($manual as $m) {
            $ledger->push(['id' => $m->id, 'manual' => true, 'date' => $m->date?->format('Y-m-d'), 'type' => $m->type, 'category' => $m->category ?: 'Manual', 'ref' => 'manual', 'desc' => $m->description, 'amount' => (float) $m->amount]);
        }

        $manualIncome = (float) $manual->where('type', 'income')->sum('amount');
        $manualExpense = (float) $manual->where('type', 'expense')->sum('amount');
        $totalIncome = (float) $income->sum('paid_amount') + $manualIncome;
        $expensePaid = (float) $expenses->where('status', 'paid')->sum('amount');
        $payrollPaid = (float) $payrolls->sum('net_salary');
        $totalExpense = $expensePaid + $payrollPaid + $manualExpense;

        // category breakdown for expenses + payroll + manual expenses
        $byCategory = $expenses->where('status', 'paid')->groupBy('category')->map(fn ($g) => (float) $g->sum('amount'));
        if ($payrollPaid > 0) {
            $byCategory['Payroll'] = ($byCategory['Payroll'] ?? 0) + $payrollPaid;
        }
        foreach ($manual->where('type', 'expense')->groupBy('category') as $cat => $g) {
            $key = $cat ?: 'Manual';
            $byCategory[$key] = ($byCategory[$key] ?? 0) + (float) $g->sum('amount');
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
            'ledger' => $ledger->sortByDesc('date')->take(80)->values(),
            'settlements' => $settlements,
        ]);
    }

    /** Add a manual ledger entry (income or expense). */
    public function storeLedgerEntry(Request $request)
    {
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 400, 'No centre assigned.');

        $data = $request->validate([
            'type' => ['required', 'in:income,expense'],
            'date' => ['required', 'date'],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0'],
        ]);
        $data['centre_id'] = $centre->id;

        return response()->json(['data' => \App\Models\LedgerEntry::create($data)], 201);
    }

    /** Bulk-add manual ledger entries (e.g. from a scanned paper register). */
    public function storeLedgerEntries(Request $request)
    {
        $centre = $this->primaryCentre($request);
        abort_unless($centre, 400, 'No centre assigned.');

        $data = $request->validate([
            'entries' => ['required', 'array', 'min:1', 'max:100'],
            'entries.*.type' => ['required', 'in:income,expense'],
            'entries.*.date' => ['required', 'date'],
            'entries.*.category' => ['nullable', 'string', 'max:100'],
            'entries.*.description' => ['required', 'string', 'max:255'],
            'entries.*.amount' => ['required', 'numeric', 'gt:0'],
        ]);

        foreach ($data['entries'] as $row) {
            \App\Models\LedgerEntry::create(array_merge($row, ['centre_id' => $centre->id]));
        }

        return response()->json(['message' => count($data['entries']).' entries added.', 'count' => count($data['entries'])], 201);
    }

    public function deleteLedgerEntry(Request $request, \App\Models\LedgerEntry $ledgerEntry)
    {
        $ids = $this->centres($request)->pluck('id');
        abort_unless($ids->contains($ledgerEntry->centre_id), 403);
        $ledgerEntry->delete();

        return response()->json(['message' => 'Entry removed.']);
    }

    /** Read a photo of a handwritten register/receipt into ledger entries. */
    public function scanLedger(Request $request, \App\Services\NidScanner $scanner)
    {
        $request->validate(['file' => ['required', 'file', 'max:8192', 'mimes:jpg,jpeg,png,webp,pdf']]);

        return response()->json(['data' => $scanner->extractLedger($request->file('file'))]);
    }

    /** Read a supplier invoice/quotation into a draft purchase order. */
    public function scanPurchaseOrder(Request $request, \App\Services\NidScanner $scanner)
    {
        $request->validate(['file' => ['required', 'file', 'max:8192', 'mimes:jpg,jpeg,png,webp,pdf']]);

        return response()->json(['data' => $scanner->extractPurchaseOrder($request->file('file'))]);
    }

    /** Read a photo/PDF of a product list into inventory rows for review. */
    public function scanProducts(Request $request, \App\Services\NidScanner $scanner)
    {
        $request->validate(['file' => ['required', 'file', 'max:8192', 'mimes:jpg,jpeg,png,webp,pdf']]);

        return response()->json(['data' => $scanner->extractProducts($request->file('file'))]);
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

        // Last 6 months revenue vs expense trend
        $monthly = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = now()->startOfMonth()->subMonths($i);
            $start = $m->copy()->startOfMonth();
            $end = $m->copy()->endOfMonth();
            $monthly[] = [
                'month' => $m->format('M'),
                'revenue' => (float) Booking::whereIn('centre_id', $ids)->whereIn('status', $paid)
                    ->whereBetween('created_at', [$start, $end])->sum('paid_amount'),
                'expense' => (float) Expense::whereIn('centre_id', $ids)->where('status', 'paid')
                    ->whereBetween('expense_date', [$start->toDateString(), $end->toDateString()])->sum('amount'),
            ];
        }

        return response()->json([
            'monthly' => $monthly,
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
