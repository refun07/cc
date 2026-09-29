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
                'capacity' => $c->capacity,
                'status' => $c->status,
                'is_verified' => (bool) $c->is_verified,
                'rating' => (float) $c->rating,
                'half_day_price' => (float) $c->half_day_price,
                'commission_rate' => (float) $c->commission_rate,
                'bookings_count' => $c->bookings_count,
                'cover_image' => $c->cover_image,
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
            'address' => ['nullable', 'string', 'max:1000'],
            'description' => ['nullable', 'string', 'max:3000'],
            'capacity' => ['required', 'integer', 'min:1'],
            'half_day_price' => ['required', 'numeric', 'min:0'],
            'full_day_price' => ['required', 'numeric', 'min:0'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:25'],
            'booking_prefix' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{2,12}$/'],
            'status' => ['required', 'in:draft,pending,active,suspended'],
            'cover_image' => ['nullable', 'url', 'max:1000'],
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
            'address' => $data['address'] ?? null,
            'description' => $data['description'] ?? null,
            'capacity' => $data['capacity'],
            'base_price' => $data['half_day_price'],
            'half_day_price' => $data['half_day_price'],
            'full_day_price' => $data['full_day_price'],
            'commission_rate' => round((float) ($data['commission_rate'] ?? 5), 2),
            'booking_prefix' => strtoupper($data['booking_prefix'] ?? 'DSCC'),
            'status' => $data['status'],
            'is_verified' => $data['status'] === 'active',
            'cover_image' => $data['cover_image'] ?? 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=70',
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
        $rows = Settlement::with('centre:id,name,slug,commission_rate')
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
                'payable' => (float) Settlement::whereIn('status', ['pending', 'approved'])->sum('net_amount'),
                'paid' => (float) Settlement::where('status', 'paid')->sum('net_amount'),
            ],
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
        $users = User::query()
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
                'status' => $u->status,
                'created_at' => $u->created_at?->toDateString(),
            ]);

        return response()->json(['data' => $users]);
    }

    public function storeUser(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/', 'unique:users,phone'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:6', 'max:255'],
            'role' => ['required', 'in:owner,waste_partner,customer'],
            'status' => ['required', 'in:active,inactive,suspended'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'status' => $data['status'],
        ]);

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'email' => $user->email,
                'role' => $user->role,
                'status' => $user->status,
                'created_at' => $user->created_at?->toDateString(),
            ],
        ], 201);
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

    public function reports()
    {
        $paid = ['paid', 'confirmed', 'completed'];

        $trend = Booking::query()
            ->selectRaw("strftime('%Y-%m', created_at) as ym, count(*) as bookings, sum(total_amount) as gmv, sum(vat_amount) as vat, sum(service_charge) as commission")
            ->groupByRaw("strftime('%Y-%m', created_at)")->orderByRaw('ym desc')->limit(6)->get()
            ->reverse()->values()->map(fn ($r) => [
                'month' => $r->ym, 'bookings' => (int) $r->bookings,
                'gmv' => (float) $r->gmv, 'vat' => (float) $r->vat,
                'commission' => (float) $r->commission,
            ]);

        $byStatus = Booking::selectRaw('status, count(*) as c')->groupBy('status')->get()
            ->map(fn ($r) => ['status' => $r->status, 'count' => (int) $r->c]);

        $topCentres = Booking::query()
            ->selectRaw('centre_id, sum(paid_amount) as revenue, count(*) as bookings')
            ->whereIn('status', $paid)->groupBy('centre_id')->orderByDesc('revenue')->limit(5)
            ->with('centre:id,name,area')->get()
            ->map(fn ($r) => ['centre' => $r->centre?->name, 'area' => $r->centre?->area, 'revenue' => (float) $r->revenue, 'bookings' => (int) $r->bookings]);

        $userGrowth = User::query()
            ->selectRaw("strftime('%Y-%m', created_at) as ym, count(*) as c")
            ->groupByRaw("strftime('%Y-%m', created_at)")->orderByRaw('ym desc')->limit(6)->get()
            ->reverse()->values()->map(fn ($r) => ['month' => $r->ym, 'users' => (int) $r->c]);

        $gmv = (float) Booking::whereIn('status', $paid)->sum('total_amount');

        return response()->json([
            'totals' => [
                'gmv' => $gmv,
                'commission' => (float) Booking::whereIn('status', $paid)->sum('service_charge'),
                'vat' => (float) Booking::whereIn('status', $paid)->sum('vat_amount'),
                'refunds' => (float) Booking::sum('refunded_amount'),
                'bookings' => Booking::count(),
                'avg_booking' => Booking::whereIn('status', $paid)->count() ? round($gmv / Booking::whereIn('status', $paid)->count()) : 0,
            ],
            'trend' => $trend,
            'by_status' => $byStatus,
            'top_centres' => $topCentres,
            'user_growth' => $userGrowth,
        ]);
    }

    public function exportBookings()
    {
        $rows = Booking::with('centre:id,name')->latest()->get();
        $headers = ['Booking No', 'Customer', 'Phone', 'Centre', 'Event Date', 'Session', 'Guests', 'Total', 'Paid', 'Status', 'Created'];
        $data = $rows->map(fn ($b) => [
            $b->booking_no, $b->customer_name, $b->customer_phone, $b->centre?->name,
            $b->event_date?->format('Y-m-d'), $b->session_type, $b->guest_count,
            $b->total_amount, $b->paid_amount, $b->status, $b->created_at?->format('Y-m-d'),
        ]);

        return $this->csv('bookings', $headers, $data);
    }

    public function exportPayments()
    {
        $rows = Payment::with('booking:id,booking_no')->latest()->get();
        $headers = ['Transaction', 'Booking No', 'Method', 'Amount', 'Refunded', 'Status', 'Paid At'];
        $data = $rows->map(fn ($p) => [
            $p->transaction_id, $p->booking?->booking_no, $p->payment_method,
            $p->amount, $p->refunded_amount, $p->status, $p->paid_at?->format('Y-m-d H:i'),
        ]);

        return $this->csv('payments', $headers, $data);
    }

    protected function csv(string $name, array $headers, $rows)
    {
        $out = fopen('php://temp', 'r+');
        fputcsv($out, $headers);
        foreach ($rows as $row) {
            fputcsv($out, $row);
        }
        rewind($out);
        $content = stream_get_contents($out);
        fclose($out);

        return response($content, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"dscc-{$name}-".now()->format('Ymd').".csv\"",
        ]);
    }

    public function payments()
    {
        $payments = Payment::with('booking.centre')
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'booking_no' => $p->booking?->booking_no,
                'centre' => $p->booking?->centre?->name,
                'method' => $p->payment_method,
                'transaction_id' => $p->transaction_id,
                'amount' => (float) $p->amount,
                'vat_amount' => (float) ($p->booking?->vat_amount ?? 0),
                'commission' => (float) ($p->booking?->service_charge ?? 0),
                'refunded_amount' => (float) $p->refunded_amount,
                'status' => $p->status,
                'paid_at' => $p->paid_at?->toDateTimeString(),
            ]);

        return response()->json(['data' => $payments]);
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
