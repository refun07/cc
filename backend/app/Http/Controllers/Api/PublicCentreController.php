<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CentreDetailResource;
use App\Http\Resources\CentreListResource;
use App\Models\CommunityCentre;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicCentreController extends Controller
{
    public function index(Request $request)
    {
        $query = CommunityCentre::query()
            ->where('status', 'active')
            ->with('facilities', 'images');

        if ($area = $request->query('area')) {
            $query->where('area', 'like', "%{$area}%");
        }

        if ($search = $request->query('q')) {
            $query->where(fn ($w) => $w->where('name', 'like', "%{$search}%")
                ->orWhere('area', 'like', "%{$search}%"));
        }

        if ($guests = $request->query('guests')) {
            $query->where('capacity', '>=', (int) $guests);
        }

        if ($max = $request->query('max_price')) {
            $query->where('half_day_price', '<=', (float) $max);
        }

        if ($request->query('verified') === 'true') {
            $query->where('is_verified', true);
        }

        $sort = $request->query('sort', 'rating');
        match ($sort) {
            'price_low' => $query->orderBy('half_day_price'),
            'price_high' => $query->orderByDesc('full_day_price'),
            default => $query->orderByDesc('rating'),
        };

        $centres = $query->paginate(12);

        return CentreListResource::collection($centres);
    }

    public function show(CommunityCentre $centre)
    {
        $centre->load('images', 'facilities', 'floors', 'decorators');

        return new CentreDetailResource($centre);
    }

    public function availability(Request $request, CommunityCentre $centre)
    {
        $slots = $centre->availabilitySlots()
            ->where('centre_floor_id', $request->query('floor_id') ?: null)
            ->when($request->query('from'), fn ($q, $from) => $q->whereDate('date', '>=', $from))
            ->when($request->query('to'), fn ($q, $to) => $q->whereDate('date', '<=', $to))
            ->get()
            ->map(fn ($s) => [
                'date' => $s->date->format('Y-m-d'),
                'session_type' => $s->session_type,
                'status' => $s->status,
            ])
            ->keyBy(fn ($slot) => $slot['date'].'|'.$slot['session_type']);

        foreach ($this->bookedDates($centre, $request->query('floor_id') ?: null, $request->query('from'), $request->query('to')) as $slot) {
            $slots[$slot['date'].'|'.$slot['session_type']] = $slot;
        }

        return response()->json(['data' => $slots->values()]);
    }

    /**
     * Per-date availability map for the booking calendar.
     * Returns, for each date, which of the 3 sessions are open.
     */
    public function calendar(Request $request, CommunityCentre $centre)
    {
        $from = $request->query('from', now()->format('Y-m-d'));
        $to = $request->query('to', now()->addDays(60)->format('Y-m-d'));

        $slots = $centre->availabilitySlots()
            ->where('centre_floor_id', $request->query('floor_id') ?: null)
            ->whereBetween('date', [$from, $to])
            ->get()
            ->map(fn ($s) => [
                'date' => $s->date->format('Y-m-d'),
                'session_type' => $s->session_type,
                'status' => $s->status,
            ])
            ->keyBy(fn ($slot) => $slot['date'].'|'.$slot['session_type']);

        foreach ($this->bookedDates($centre, $request->query('floor_id') ?: null, $from, $to) as $slot) {
            $slots[$slot['date'].'|'.$slot['session_type']] = $slot;
        }

        $slots = $slots->values()
            ->groupBy('date');

        $days = [];
        foreach ($slots as $date => $daySlots) {
            $byType = $daySlots->keyBy('session_type');
            $open = fn ($t) => ! isset($byType[$t]) || $byType[$t]['status'] === 'available';

            $fullOpen = $open('full_day') && $open('half_day_morning') && $open('half_day_evening');
            $morningOpen = $open('half_day_morning') && $open('full_day');
            $eveningOpen = $open('half_day_evening') && $open('full_day');

            $days[] = [
                'date' => $date,
                'full_day' => $fullOpen,
                'half_day_morning' => $morningOpen,
                'half_day_evening' => $eveningOpen,
                'any' => $fullOpen || $morningOpen || $eveningOpen,
            ];
        }

        return response()->json(['data' => $days]);
    }

    private function bookedDates(CommunityCentre $centre, ?string $floorId, ?string $from, ?string $to)
    {
        return DB::table('booking_dates')
            ->join('bookings', 'bookings.id', '=', 'booking_dates.booking_id')
            ->where('bookings.centre_id', $centre->id)
            ->where('bookings.centre_floor_id', $floorId)
            ->whereNotIn('bookings.status', ['cancelled', 'refunded'])
            ->when($from, fn ($query) => $query->whereDate('booking_dates.date', '>=', $from))
            ->when($to, fn ($query) => $query->whereDate('booking_dates.date', '<=', $to))
            ->get(['booking_dates.date', 'booking_dates.session_type'])
            ->map(fn ($row) => [
                'date' => $row->date,
                'session_type' => $row->session_type,
                'status' => 'booked',
            ]);
    }

    public function foodMenus(CommunityCentre $centre)
    {
        $menus = $centre->foodMenus()->where('status', 'active')->get()->map(fn ($m) => [
            'id' => $m->id,
            'name' => $m->name,
            'description' => $m->description,
            'items' => $m->items,
            'menu_type' => $m->menu_type,
            'price_per_person' => (float) $m->price_per_person,
            'min_guest_count' => $m->min_guest_count,
        ]);

        return response()->json(['data' => $menus]);
    }
}
