<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\AppSetting;
use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\Payment;
use App\Models\Settlement;
use App\Models\User;
use App\Services\SettlementService;
use App\Support\HomepageContent;
use App\Support\CoordinatorPermissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function dashboard()
    {
        $paidStatuses = ['paid', 'confirmed', 'completed'];

        $monthExpression = match (DB::connection()->getDriverName()) {
            'sqlite' => "strftime('%Y-%m', created_at)",
            'pgsql' => "to_char(created_at, 'YYYY-MM')",
            default => "DATE_FORMAT(created_at, '%Y-%m')",
        };

        $gmv = (float) Booking::whereIn('status', $paidStatuses)->sum('total_amount');
        $vat = (float) Booking::whereIn('status', $paidStatuses)->sum('vat_amount');
        $commission = (float) Booking::whereIn('status', $paidStatuses)->sum('service_charge');

        // last 6 months booking trend
        $trend = Booking::query()
            ->selectRaw("{$monthExpression} as ym, count(*) as bookings, sum(total_amount) as revenue")
            ->groupByRaw($monthExpression)
            ->orderByRaw("ym desc")
            ->limit(6)
            ->get()
            ->reverse()
            ->values()
            ->map(fn ($r) => [
                'month' => $r->ym,
                'bookings' => (int) $r->bookings,
                'revenue' => (float) $r->revenue,
            ]);

        return response()->json([
            'stats' => [
                'centres' => CommunityCentre::count(),
                'active_centres' => CommunityCentre::where('status', 'active')->count(),
                'pending_centres' => CommunityCentre::where('status', 'pending')->count(),
                'bookings' => Booking::count(),
                'customers' => User::where('role', 'customer')->count(),
                'owners' => User::where('role', 'owner')->count(),
                'gmv' => $gmv,
                'commission' => $commission,
                'vat' => $vat,
                'pending_review' => Booking::where('status', 'pending_review')->count(),
                'cancelled' => Booking::where('status', 'cancelled')->count(),
            ],
            'trend' => $trend,
            'recent_bookings' => BookingResource::collection(
                Booking::with('centre', 'payment', 'foodItems', 'bookingDates')->latest()->limit(8)->get()
            ),
        ]);
    }

    public function centres(Request $request)
    {
        $centres = CommunityCentre::withCount('bookings')
            ->when($request->query('q'), fn ($q, $s) => $q->where('name', 'like', "%{$s}%")->orWhere('area', 'like', "%{$s}%"))
            ->latest()
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'area' => $c->area,
                'working_area' => $c->working_area,
                'centre_type' => $c->centre_type,
                'capacity' => $c->capacity,
                'status' => $c->status,
                'is_verified' => (bool) $c->is_verified,
                'rating' => (float) $c->rating,
                'half_day_price' => (float) $c->half_day_price,
                'commission_rate' => (float) $c->commission_rate,
                'bookings_count' => $c->bookings_count,
                'cover_image' => $c->cover_image,
                'decorator_phone' => $c->decorator_phone,
                'decorator_name' => $c->decorator_name,
            ]);

        return response()->json(['data' => $centres]);
    }

    public function storeCentre(Request $request)
    {
        $data = $request->validate([
            'owner_id' => ['nullable', 'exists:users,id'],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'alpha_dash', 'unique:community_centres,slug'],
            'area' => ['required', 'string', 'max:255'],
            'working_area' => ['nullable', 'string', 'max:120'],
            'centre_type' => ['sometimes', Rule::in(['community_centre', 'convention_centre', 'banquet_hall', 'other'])],
            'address' => ['nullable', 'string', 'max:1000'],
            'description' => ['nullable', 'string', 'max:3000'],
            'capacity' => ['required', 'integer', 'min:1'],
            'half_day_price' => ['required', 'numeric', 'min:0'],
            'full_day_price' => ['required', 'numeric', 'min:0'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:25'],
            'booking_prefix' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{2,12}$/'],
            'status' => ['required', 'in:draft,pending,active,suspended'],
            'cover_image' => ['nullable', 'url', 'max:1000'],
            'decorator_phone' => ['nullable', 'regex:/^01[0-9]{9}$/'],
            'decorator_name' => ['nullable', 'string', 'max:255'],
        ], [
            'booking_prefix.regex' => 'Prefix must be 2-12 letters or numbers, no spaces.',
        ]);

        if (! empty($data['owner_id'])) {
            User::where('id', $data['owner_id'])->where('role', 'owner')->firstOrFail();
        }

        $slug = $data['slug'] ?? Str::slug($data['name']);
        if (! $slug) {
            $slug = Str::lower(Str::random(8));
        }

        $baseSlug = $slug;
        $suffix = 2;
        while (CommunityCentre::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$suffix}";
            $suffix++;
        }

        $centre = CommunityCentre::create([
            'owner_id' => $data['owner_id'] ?? null,
            'name' => $data['name'],
            'slug' => $slug,
            'area' => $data['area'],
            'working_area' => $data['working_area'] ?? $data['area'],
            'centre_type' => $data['centre_type'] ?? 'community_centre',
            'address' => $data['address'] ?? null,
            'description' => $data['description'] ?? null,
            'capacity' => $data['capacity'],
            'base_price' => $data['half_day_price'],
            'half_day_price' => $data['half_day_price'],
            'full_day_price' => $data['full_day_price'],
            'commission_rate' => round((float) ($data['commission_rate'] ?? 5), 2),
            'booking_prefix' => strtoupper($data['booking_prefix'] ?? 'ICCMS'),
            'status' => $data['status'],
            'is_verified' => $data['status'] === 'active',
            'cover_image' => $data['cover_image'] ?? 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=70',
            'decorator_phone' => $data['decorator_phone'] ?? null,
            'decorator_name' => $data['decorator_name'] ?? null,
        ]);

        return response()->json(['data' => $centre], 201);
    }

    public function updateCentreStatus(Request $request, CommunityCentre $centre)
    {
        $data = $request->validate([
            'status' => ['required', 'in:draft,pending,active,suspended'],
        ]);
        $centre->update([
            'status' => $data['status'],
            'is_verified' => $data['status'] === 'active' ? true : $centre->is_verified,
        ]);

        return response()->json(['message' => 'Centre updated.', 'status' => $centre->status]);
    }

    public function updateCentreType(Request $request, CommunityCentre $centre)
    {
        $data = $request->validate([
            'centre_type' => ['required', Rule::in(['community_centre', 'convention_centre', 'banquet_hall', 'other'])],
        ]);
        $centre->update($data);

        return response()->json(['data' => $centre->only(['id', 'centre_type'])]);
    }

    public function updateCentreLocation(Request $request, CommunityCentre $centre)
    {
        $data = $request->validate([
            'area' => ['required', 'string', 'max:120'],
            'working_area' => ['required', 'string', 'max:120'],
        ]);
        $centre->update($data);

        return response()->json(['data' => $centre->only(['id', 'area', 'working_area'])]);
    }

    public function updateDecoratorContact(Request $request, CommunityCentre $centre)
    {
        $data = $request->validate([
            'decorator_phone' => ['nullable', 'regex:/^01[0-9]{9}$/'],
            'decorator_name' => ['nullable', 'string', 'max:255'],
        ]);
        $centre->update([
            'decorator_phone' => $data['decorator_phone'] ?? null,
            'decorator_name' => $data['decorator_name'] ?? null,
        ]);

        return response()->json(['data' => $centre->only(['decorator_name', 'decorator_phone'])]);
    }

    public function updateDecoratorPhone(Request $request, CommunityCentre $centre)
    {
        $data = $request->validate(['decorator_phone' => ['nullable', 'regex:/^01[0-9]{9}$/']]);
        $centre->update(['decorator_phone' => $data['decorator_phone'] ?? null]);

        return response()->json(['decorator_phone' => $centre->decorator_phone]);
    }

    public function updateCommissionRate(Request $request, CommunityCentre $centre)
    {
        $data = $request->validate([
            'commission_rate' => ['required', 'numeric', 'min:0', 'max:25'],
        ]);
        $centre->update(['commission_rate' => round((float) $data['commission_rate'], 2)]);

        return response()->json([
            'message' => 'Commission rate updated for future bookings.',
            'commission_rate' => (float) $centre->commission_rate,
        ]);
    }

    public function settlements(Request $request)
    {
        $rows = Settlement::withCashFlag()->with('centre:id,name,slug,commission_rate')
            ->withCount('items')
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('centre_id'), fn ($q, $centreId) => $q->where('centre_id', $centreId))
            ->latest()
            ->get();

        return response()->json([
            'summary' => [
                'gross' => (float) Settlement::sum('gross_amount'),
                'commission' => (float) Settlement::sum('commission_amount'),
                'tax' => (float) Settlement::sum('tax_amount'),
                'payable' => (float) Settlement::withoutCentreCash()->whereIn('status', ['pending', 'approved'])->sum('net_amount'),
                'cash_blocked' => (float) Settlement::whereIn('status', ['pending', 'approved', 'held'])->whereHas('items', fn ($items) => $items->centreCash())->sum('net_amount'),
                'paid' => (float) Settlement::where('status', 'paid')->sum('net_amount'),
            ],
            'centre_cash' => \App\Services\PaymentReceipts::centreCashSummary(),
            'data' => $rows,
        ]);
    }

    public function storeSettlement(Request $request, SettlementService $service)
    {
        $data = $request->validate([
            'centre_id' => ['required', 'exists:community_centres,id'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'adjustment_amount' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $centre = CommunityCentre::findOrFail($data['centre_id']);
        $settlement = $service->generate($centre, $data, $request->user());

        return response()->json(['data' => $settlement], 201);
    }

    public function updateSettlement(Request $request, Settlement $settlement, SettlementService $service)
    {
        $data = $request->validate([
            'status' => ['required', 'in:pending,approved,paid,held'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'payment_reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json(['data' => $service->transition($settlement->load('centre'), $data)]);
    }

    public function users(Request $request)
    {
        $users = User::query()->with('coordinatorCentres:id,name')
            ->when($request->query('role'), fn ($q, $r) => $q->where('role', $r))
            ->when($request->query('q'), fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'like', "%{$s}%")->orWhere('phone', 'like', "%{$s}%")))
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'phone' => $u->phone,
                'email' => $u->email,
                'role' => $u->role,
                'area_scope' => $u->area_scope,
                'caretaker_centre_id' => $u->role === 'caretaker' ? $u->caretaker_centre_id : null,
                'coordinator_permissions' => in_array($u->role, ['project_coordinator', 'caretaker']) ? ($u->coordinator_permissions ?? []) : [],
                'centre_ids' => in_array($u->role, ['project_coordinator', 'caretaker']) ? $u->assignedCentreIds()->all() : [],
                'status' => $u->status,
                'created_at' => $u->created_at?->toDateString(),
            ]);

        return response()->json(['data' => $users]);
    }

    public function storeUser(Request $request)
    {
        if ($request->input('role') === 'project_coordinator') {
            $request->merge(['role' => 'caretaker']);
        }
        // Accept the previous single-centre caretaker form while exposing multi-centre access.
        if ($request->input('role') === 'caretaker' && blank($request->input('centre_ids')) && $request->filled('caretaker_centre_id')) {
            $request->merge(['centre_ids' => [$request->integer('caretaker_centre_id')]]);
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', 'unique:users,phone'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:6', 'max:255'],
            'role' => ['required', 'in:owner,waste_partner,customer,area_admin,project_coordinator,caretaker'],
            'area_scope' => ['exclude_unless:role,area_admin', 'required', Rule::in(CommunityCentre::distinct()->pluck('working_area')->filter()->all())],
            'centre_ids' => ['exclude_unless:role,project_coordinator,caretaker', 'required', 'array', 'min:1'],
            'centre_ids.*' => ['integer', 'distinct', Rule::exists('community_centres', 'id')],
            'coordinator_permissions' => ['exclude_unless:role,project_coordinator,caretaker', 'sometimes', 'array'],
            'coordinator_permissions.*' => ['string', 'distinct', Rule::in(CoordinatorPermissions::ALL)],
            'status' => ['required', 'in:active,inactive,suspended'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'password' => Hash::make($data['password']),
                'role' => $data['role'],
                'area_scope' => $data['role'] === 'area_admin' ? $data['area_scope'] : null,
                'caretaker_centre_id' => $data['role'] === 'caretaker' ? $data['centre_ids'][0] : null,
                'coordinator_permissions' => in_array($data['role'], ['project_coordinator', 'caretaker']) ? ($data['coordinator_permissions'] ?? []) : null,
                'status' => $data['status'],
            ]);
            if (in_array($user->role, ['project_coordinator', 'caretaker'])) {
                $user->coordinatorCentres()->sync($data['centre_ids']);
            }

            return $user;
        });

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'email' => $user->email,
                'role' => $user->role,
                'area_scope' => $user->area_scope,
                'caretaker_centre_id' => $user->caretaker_centre_id,
                'coordinator_permissions' => $user->coordinator_permissions ?? [],
                'centre_ids' => $user->coordinatorCentres()->pluck('community_centres.id')->all(),
                'status' => $user->status,
                'created_at' => $user->created_at?->toDateString(),
            ],
        ], 201);
    }

    public function updateCoordinator(Request $request, User $user)
    {
        if ($user->role === 'caretaker') {
            return $this->updateCaretaker($request, $user);
        }
        abort_unless($user->role === 'project_coordinator', 422, 'This account is not a project coordinator.');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', Rule::unique('users', 'phone')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
            'centre_ids' => ['required', 'array', 'min:1'],
            'centre_ids.*' => ['integer', 'distinct', Rule::exists('community_centres', 'id')],
            'coordinator_permissions' => ['present', 'array'],
            'coordinator_permissions.*' => ['string', 'distinct', Rule::in(CoordinatorPermissions::ALL)],
        ]);

        DB::transaction(function () use ($user, $data) {
            $changes = [
                'name' => $data['name'],
                'phone' => $data['phone'],
                'coordinator_permissions' => $data['coordinator_permissions'],
            ];
            if (filled($data['password'] ?? null)) {
                $changes['password'] = Hash::make($data['password']);
            }
            $user->update($changes);
            $user->coordinatorCentres()->sync($data['centre_ids']);
        });

        return response()->json(['data' => [
            'id' => $user->id,
            'name' => $user->name,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'centre_ids' => $user->coordinatorCentres()->pluck('community_centres.id')->all(),
            'coordinator_permissions' => $user->coordinator_permissions ?? [],
        ]]);
    }

    public function updateAreaAdmin(Request $request, User $user)
    {
        abort_unless($user->role === 'area_admin', 422, 'This account is not an area administrator.');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', Rule::unique('users', 'phone')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
            'area_scope' => ['required', Rule::in(CommunityCentre::distinct()->pluck('working_area')->filter()->all())],
        ]);

        $changes = [
            'name' => $data['name'],
            'phone' => $data['phone'],
            'area_scope' => $data['area_scope'],
        ];
        if (filled($data['password'] ?? null)) {
            $changes['password'] = Hash::make($data['password']);
        }
        $user->update($changes);

        return response()->json(['data' => $user->only(['id', 'name', 'phone', 'role', 'area_scope', 'status'])]);
    }

    public function updateCaretaker(Request $request, User $user)
    {
        abort_unless($user->role === 'caretaker', 422, 'This account is not a caretaker.');
        if (blank($request->input('centre_ids')) && $request->filled('caretaker_centre_id')) {
            $request->merge(['centre_ids' => [$request->integer('caretaker_centre_id')]]);
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', Rule::unique('users', 'phone')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
            'centre_ids' => ['required', 'array', 'min:1'],
            'centre_ids.*' => ['integer', 'distinct', Rule::exists('community_centres', 'id')],
            'coordinator_permissions' => ['sometimes', 'array'],
            'coordinator_permissions.*' => ['string', 'distinct', Rule::in(CoordinatorPermissions::ALL)],
        ]);

        $changes = [
            'name' => $data['name'],
            'phone' => $data['phone'],
            'caretaker_centre_id' => $data['centre_ids'][0],
            'coordinator_permissions' => $data['coordinator_permissions'] ?? $user->coordinator_permissions,
        ];
        if (filled($data['password'] ?? null)) {
            $changes['password'] = Hash::make($data['password']);
        }
        DB::transaction(function () use ($user, $changes, $data) {
            $user->update($changes);
            $user->coordinatorCentres()->sync($data['centre_ids']);
        });

        return response()->json(['data' => $user->only(['id', 'name', 'phone', 'role', 'caretaker_centre_id', 'status', 'coordinator_permissions']) + ['centre_ids' => $user->assignedCentreIds()->all()]]);
    }

    /** Suspend or re-activate a user account. */
    public function updateUserStatus(Request $request, User $user)
    {
        $data = $request->validate(['status' => ['required', 'in:active,inactive,suspended']]);
        abort_if($user->role === 'admin', 422, 'Admin accounts cannot be changed here.');
        $user->update(['status' => $data['status']]);

        return response()->json(['message' => 'User updated.', 'status' => $user->status]);
    }

    /** Issue a token to act on behalf of an owner/partner account (admin take-control). */
    public function impersonate(Request $request, User $user)
    {
        abort_unless(in_array($user->role, ['owner', 'waste_partner'], true), 422, 'Only vendor accounts can be accessed.');
        $user->update(['api_token' => \Illuminate\Support\Str::random(72)]);

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'phone' => $user->phone, 'email' => $user->email, 'role' => $user->role],
            'token' => $user->api_token,
        ]);
    }

    public function bookings(Request $request)
    {
        $bookings = Booking::with('centre', 'payment', 'foodItems', 'bookingDates')
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->query('q'), fn ($q, $s) => $q->where('booking_no', 'like', "%{$s}%")->orWhere('customer_name', 'like', "%{$s}%"))
            ->latest()
            ->limit(100)
            ->get();

        return BookingResource::collection($bookings);
    }

    /** Admin creates a booking on behalf of a customer for any centre. */
    public function storeBooking(Request $request)
    {
        $data = $request->validate([
            'centre_slug' => ['required', 'exists:community_centres,slug'],
            'centre_floor_id' => ['nullable', 'integer', 'exists:centre_floors,id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email'],
            'event_date' => ['required', 'date', 'after_or_equal:today'],
            'session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
            'guest_count' => ['required', 'integer', 'min:1'],
            'event_type' => ['nullable', 'string', 'max:255'],
            'event_manager_name' => ['nullable', 'required_with:event_manager_phone', 'string', 'max:255'],
            'event_manager_phone' => ['nullable', 'required_with:event_manager_name', 'regex:/^01[0-9]{9}$/'],
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

        $centre = CommunityCentre::where('slug', $data['centre_slug'])->firstOrFail();
        $service = app(\App\Services\BookingService::class);

        $booking = DB::transaction(function () use ($centre, $data, $request, $service) {
            $booking = $service->create($centre, $data);
            $booking->update(['status' => 'payment_pending']);

            if ($request->boolean('mark_paid')) {
                $service->applyPayment(
                    $booking,
                    $data['payment_method'] ?? 'Cash',
                    $data['payment_option'] ?? 'full',
                    isset($data['custom_payment_amount']) ? (float) $data['custom_payment_amount'] : null
                );
            }

            return $booking->fresh();
        });

        \App\Services\Notify::send($centre->owner_id, 'New booking (by admin)',
            "{$booking->customer_name} booked {$centre->name} on {$booking->event_date->format('d M Y')}.", 'booking', '/owner/bookings');

        return (new BookingResource($booking->fresh()->load('centre', 'payment', 'foodItems', 'bookingDates')))
            ->response()->setStatusCode(201);
    }

    public function updateBookingNote(Request $request, string $bookingNo)
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);
        $booking = Booking::where('booking_no', $bookingNo)->firstOrFail();
        $booking->update(['notes' => $data['notes']]);

        return response()->json(['message' => 'Note saved.', 'notes' => $booking->notes]);
    }

    private function reportFilters(Request $request): array
    {
        return $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'centre_name' => ['nullable', 'string', 'max:255'],
            'area' => ['nullable', 'string', 'max:255'],
            'centre_type' => ['nullable', Rule::in(['community_centre', 'convention_centre', 'banquet_hall', 'other'])],
            'centre_id' => ['nullable', 'integer', 'exists:community_centres,id'],
            'booking_status' => ['nullable', Rule::in(['draft', 'pending_review', 'payment_pending', 'paid', 'confirmed', 'cancelled', 'completed', 'refunded'])],
            'payment_status' => ['nullable', Rule::in(['pending', 'paid', 'failed', 'refunded'])],
        ]);
    }

    private function filteredBookings(array $filters)
    {
        return Booking::query()
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', "{$from} 00:00:00"))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<', \Illuminate\Support\Carbon::parse($to)->addDay()->toDateString()))
            ->when($filters['centre_id'] ?? null, fn ($q, $id) => $q->where('centre_id', $id))
            ->when($filters['centre_type'] ?? null, fn ($q, $type) => $q->whereHas('centre', fn ($centre) => $centre->where('centre_type', $type)))
            ->when($filters['centre_name'] ?? null, fn ($q, $name) => $q->whereHas('centre', fn ($centre) => $centre->where('name', 'like', "%{$name}%")))
            ->when($filters['area'] ?? null, fn ($q, $area) => $q->whereHas('centre', fn ($centre) => $centre->where('area', 'like', "%{$area}%")))
            ->when($filters['booking_status'] ?? null, fn ($q, $status) => $q->where('status', $status));
    }

    public function reports(Request $request)
    {
        $filters = $this->reportFilters($request);
        $bookings = $this->filteredBookings($filters);
        $paid = ['paid', 'confirmed', 'completed'];

        $monthExpression = match (DB::connection()->getDriverName()) {
            'sqlite' => "strftime('%Y-%m', created_at)",
            'pgsql' => "to_char(created_at, 'YYYY-MM')",
            default => "DATE_FORMAT(created_at, '%Y-%m')",
        };

        $trend = (clone $bookings)
            ->selectRaw("{$monthExpression} as ym, count(*) as bookings, sum(case when status in ('paid', 'confirmed', 'completed') then total_amount else 0 end) as gmv, sum(case when status in ('paid', 'confirmed', 'completed') then vat_amount else 0 end) as vat, sum(case when status in ('paid', 'confirmed', 'completed') then service_charge else 0 end) as commission")
            ->groupByRaw($monthExpression)->orderByRaw('ym desc')->limit(6)->get()
            ->reverse()->values()->map(fn ($r) => [
                'month' => $r->ym, 'bookings' => (int) $r->bookings,
                'gmv' => (float) $r->gmv, 'vat' => (float) $r->vat,
                'commission' => (float) $r->commission,
            ]);

        $byStatus = (clone $bookings)->selectRaw('status, count(*) as c')->groupBy('status')->get()
            ->map(fn ($r) => ['status' => $r->status, 'count' => (int) $r->c]);

        $topCentres = (clone $bookings)
            ->selectRaw('centre_id, sum(paid_amount) as revenue, count(*) as bookings')
            ->whereIn('status', $paid)->groupBy('centre_id')->orderByDesc('revenue')->limit(5)
            ->with('centre:id,name,area')->get()
            ->map(fn ($r) => ['centre' => $r->centre?->name, 'area' => $r->centre?->area, 'revenue' => (float) $r->revenue, 'bookings' => (int) $r->bookings]);

        $paidBookings = (clone $bookings)->whereIn('status', $paid);
        $gmv = (float) (clone $paidBookings)->sum('total_amount');
        $paidCount = (clone $paidBookings)->count();

        return response()->json([
            'totals' => [
                'gmv' => $gmv,
                'commission' => (float) (clone $paidBookings)->sum('service_charge'),
                'vat' => (float) (clone $paidBookings)->sum('vat_amount'),
                'refunds' => (float) (clone $bookings)->sum('refunded_amount'),
                'bookings' => (clone $bookings)->count(),
                'avg_booking' => $paidCount ? round($gmv / $paidCount) : 0,
            ],
            'trend' => $trend,
            'by_status' => $byStatus,
            'top_centres' => $topCentres,
            'booking_growth' => $trend->map(fn ($row) => ['month' => $row['month'], 'bookings' => $row['bookings']]),
        ]);
    }

    public function exportBookings(Request $request)
    {
        $filters = $this->reportFilters($request);
        $rows = $this->filteredBookings($filters)->with('centre:id,name,centre_type')->latest()->get();
        $headers = ['Booking No', 'Customer', 'Phone', 'Centre', 'Centre Type', 'Event Date', 'Session', 'Guests', 'Total', 'Paid', 'Status', 'Created'];
        $data = $rows->map(fn ($b) => [
            $b->booking_no, $b->customer_name, $b->customer_phone, $b->centre?->name, $b->centre?->centre_type,
            $b->event_date?->format('Y-m-d'), $b->session_type, $b->guest_count,
            $b->total_amount, $b->paid_amount, $b->status, $b->created_at?->format('Y-m-d'),
        ]);

        return $this->csv('bookings', $headers, $data);
    }

    public function exportPayments(Request $request)
    {
        $filters = $this->reportFilters($request);
        $rows = \App\Services\PaymentReceipts::reportQuery()->with('booking.centre')
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('paid_at', '>=', "{$from} 00:00:00"))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('paid_at', '<', \Illuminate\Support\Carbon::parse($to)->addDay()->toDateString()))
            ->when($filters['centre_id'] ?? null, fn ($q, $id) => $q->whereHas('booking', fn ($booking) => $booking->where('centre_id', $id)))
            ->when($filters['centre_type'] ?? null, fn ($q, $type) => $q->whereHas('booking.centre', fn ($centre) => $centre->where('centre_type', $type)))
            ->when($filters['centre_name'] ?? null, fn ($q, $name) => $q->whereHas('booking.centre', fn ($centre) => $centre->where('name', 'like', "%{$name}%")))
            ->when($filters['area'] ?? null, fn ($q, $area) => $q->whereHas('booking.centre', fn ($centre) => $centre->where('area', 'like', "%{$area}%")))
            ->when($filters['payment_status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('paid_at')->get();
        $headers = ['Transaction', 'Booking No', 'Centre', 'Centre Type', 'Method', 'Amount', 'Refunded', 'Status', 'Paid At', 'History source'];
        $data = $rows->map(fn ($p) => [
            $p->transaction_id, $p->booking?->booking_no, $p->booking?->centre?->name, $p->booking?->centre?->centre_type, $p->payment_method,
            $p->amount, $p->refunded_amount, $p->status, $p->paid_at?->format('Y-m-d H:i'), $p->source,
        ]);

        return $this->csv('payments', $headers, $data);
    }

    protected function csv(string $name, array $headers, $rows)
    {
        $out = fopen('php://temp', 'r+');
        fputcsv($out, $headers);
        foreach ($rows as $row) {
            fputcsv($out, array_map(function ($cell) {
                if (is_string($cell) && preg_match('/^[\s\x00-\x1F]*[=+\-@]/u', $cell)) {
                    return "'".$cell;
                }
                return $cell;
            }, $row));
        }
        rewind($out);
        $content = stream_get_contents($out);
        fclose($out);

        return response($content, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"iccms-{$name}-".now()->format('Ymd').".csv\"",
            'X-Export-Count' => (string) count($rows),
        ]);
    }

    public function payments(Request $request)
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'centre_type' => ['nullable', Rule::in(['community_centre', 'convention_centre', 'banquet_hall', 'other'])],
            'centre_id' => ['nullable', 'integer', 'exists:community_centres,id'],
            'sort' => ['nullable', Rule::in(['transaction_id', 'booking_no', 'centre', 'method', 'amount', 'vat_amount', 'commission', 'refunded_amount', 'status', 'paid_at'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $query = \App\Services\PaymentReceipts::reportQuery()
            ->join('bookings', 'bookings.id', '=', 'payments.booking_id')
            ->join('community_centres', 'community_centres.id', '=', 'bookings.centre_id')
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('payments.paid_at', '>=', "{$from} 00:00:00"))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('payments.paid_at', '<', \Illuminate\Support\Carbon::parse($to)->addDay()->toDateString()))
            ->when($filters['centre_type'] ?? null, fn ($q, $type) => $q->where('community_centres.centre_type', $type))
            ->when($filters['centre_id'] ?? null, fn ($q, $id) => $q->where('community_centres.id', $id));

        $totals = (clone $query)->whereIn('payments.status', ['paid', 'refunded'])
            ->selectRaw('COALESCE(SUM(payments.amount), 0) as amount, COALESCE(SUM(payments.vat_amount), 0) as vat, COALESCE(SUM(payments.commission), 0) as commission')->first();
        $legacyCount = (clone $query)->where('payments.source', 'legacy_aggregate')->count();
        $sortColumns = [
            'transaction_id' => 'payments.transaction_id', 'booking_no' => 'bookings.booking_no',
            'centre' => 'community_centres.name', 'method' => 'payments.payment_method',
            'amount' => 'payments.amount', 'vat_amount' => 'payments.vat_amount',
            'commission' => 'payments.commission', 'refunded_amount' => 'payments.refunded_amount',
            'status' => 'payments.status', 'paid_at' => 'payments.paid_at',
        ];
        $sort = $filters['sort'] ?? 'paid_at';
        $direction = $filters['dir'] ?? 'desc';
        $payments = $query->with('booking.centre')->select('payments.*')
            ->orderBy($sortColumns[$sort], $direction)->orderByDesc('payments.id')
            ->paginate(50);

        $rows = $payments->getCollection()->map(fn ($p) => [
                'id' => $p->id,
                'booking_no' => $p->booking?->booking_no,
                'centre' => $p->booking?->centre?->name,
                'centre_type' => $p->booking?->centre?->centre_type,
                'method' => $p->payment_method,
                'transaction_id' => $p->transaction_id,
                'amount' => (float) $p->amount,
                'vat_amount' => (float) $p->vat_amount,
                'commission' => (float) $p->commission,
                'source' => $p->source,
                'refunded_amount' => (float) $p->refunded_amount,
                'status' => $p->status,
                'paid_at' => $p->paid_at?->toDateTimeString(),
            ]);

        return response()->json([
            'data' => $rows,
            'meta' => ['current_page' => $payments->currentPage(), 'last_page' => $payments->lastPage(), 'total' => $payments->total()],
            'totals' => ['amount' => (float) $totals->amount, 'vat' => (float) $totals->vat, 'commission' => (float) $totals->commission],
            'history' => ['legacy_aggregate_count' => $legacyCount, 'complete' => $legacyCount === 0],
            'centres' => CommunityCentre::orderBy('name')->get(['id', 'name', 'centre_type']),
        ]);
    }

    /** Global HR / payroll rules configurable by admin. */
    // ---- Home page content (public marketing copy) ----

    public function homepage()
    {
        return response()->json(['data' => HomepageContent::get()]);
    }

    public function updateHomepage(Request $request)
    {
        $data = $request->validate([
            'hero' => ['required', 'array'],
            'hero.badge' => ['nullable', 'string', 'max:255'],
            'hero.title_lead' => ['required', 'string', 'max:255'],
            'hero.title_highlight' => ['nullable', 'string', 'max:255'],
            'hero.subtitle' => ['nullable', 'string', 'max:1000'],
            'hero.search_placeholder' => ['nullable', 'string', 'max:120'],
            'hero.trust_badges' => ['nullable', 'array', 'max:4'],
            'hero.trust_badges.*' => ['required', 'string', 'max:60'],

            'stats' => ['nullable', 'array', 'max:6'],
            'stats.*.label' => ['required', 'string', 'max:60'],
            'stats.*.value' => ['required', 'numeric', 'min:0'],
            'stats.*.suffix' => ['nullable', 'string', 'max:5'],
            'stats.*.icon' => ['nullable', 'string', 'max:40'],

            'features_heading' => ['nullable', 'string', 'max:160'],
            'features_subheading' => ['nullable', 'string', 'max:255'],
            'features' => ['nullable', 'array', 'max:9'],
            'features.*.icon' => ['nullable', 'string', 'max:40'],
            'features.*.title' => ['required', 'string', 'max:80'],
            'features.*.description' => ['nullable', 'string', 'max:255'],

            'steps_heading' => ['nullable', 'string', 'max:160'],
            'steps' => ['nullable', 'array', 'max:6'],
            'steps.*.title' => ['required', 'string', 'max:80'],
            'steps.*.description' => ['nullable', 'string', 'max:255'],
            'footer_links' => ['present', 'array', 'max:8'],
            'footer_links.*.label' => ['required', 'string', 'max:80'],
            'footer_links.*.label_bn' => ['nullable', 'string', 'max:80'],
            'footer_links.*.url' => ['required', 'url', 'starts_with:https://,http://', 'max:1000'],
        ]);

        return response()->json(['data' => HomepageContent::put($data)]);
    }

    public function resetHomepage()
    {
        return response()->json(['data' => HomepageContent::reset()]);
    }

    public function settings()
    {
        return response()->json(['data' => [
            'absence_deduction_rate' => (float) AppSetting::get('absence_deduction_rate', 1.0),
            'late_penalty' => (float) AppSetting::get('late_penalty', 0),
            'leave_deduction_rate' => (float) AppSetting::get('leave_deduction_rate', 0),
            'late_cutoff' => AppSetting::get('late_cutoff', '10:00'),
        ]]);
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'absence_deduction_rate' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'late_penalty' => ['nullable', 'numeric', 'min:0'],
            'leave_deduction_rate' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'late_cutoff' => ['nullable', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
        ]);
        foreach ($data as $key => $value) {
            AppSetting::put($key, (string) $value);
        }

        return $this->settings();
    }
}
