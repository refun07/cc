<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Services\BookingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CoordinatorController extends Controller
{
    public function overview(Request $request)
    {
        $user = $request->user();
        $ids = $user->assignedCentreIds();
        $canSeeCentres = $user->hasCoordinatorPermission('centres.view');
        $canSeeBookings = $user->hasCoordinatorPermission('bookings.view');
        $canVerify = $canSeeBookings && $user->hasCoordinatorPermission('bookings.verify');
        $today = now('Asia/Dhaka')->toDateString();

        $centres = $canSeeCentres || $user->hasCoordinatorPermission('bookings.create')
            ? CommunityCentre::whereIn('id', $ids)->orderBy('name')
                ->get(['id', 'name', 'slug', 'area', 'status', 'capacity'])
            : collect();

        $toRow = function (Booking $booking) use ($canVerify, $today) {
            $lastDate = $booking->bookingDates->max(fn ($slot) => $slot->date?->format('Y-m-d'))
                ?? $booking->event_date?->format('Y-m-d');

            return [
                    'booking_no' => $booking->booking_no,
                    'centre' => $booking->centre?->name,
                    'floor' => $booking->floor?->name,
                    'event_date' => $booking->event_date?->format('Y-m-d'),
                    'session_type' => $booking->session_type,
                    'customer_name' => $booking->customer_name,
                    'customer_phone' => $booking->customer_phone,
                    'event_manager_name' => $booking->event_manager_name,
                    'event_manager_phone' => $booking->event_manager_phone,
                    'event_type' => $booking->event_type,
                    'guest_count' => $booking->guest_count,
                    'total_amount' => (float) $booking->total_amount,
                    'paid_amount' => (float) $booking->paid_amount,
                    'due_amount' => (float) $booking->due_amount,
                    'booking_dates' => $booking->bookingDates->map(fn ($slot) => [
                        'date' => $slot->date?->format('Y-m-d'),
                        'session_type' => $slot->session_type,
                    ])->values(),
                    'status' => $booking->status,
                    'notes' => $booking->notes,
                    'last_event_date' => $lastDate,
                    'can_verify' => $canVerify && $booking->status === 'completed'
                        && $booking->completion_verified_at === null
                        && (float) $booking->due_amount <= 0
                        && $lastDate !== null && $lastDate <= $today,
                    'completion_verified_at' => $booking->completion_verified_at?->toIso8601String(),
                ];
        };

        $bookings = $canSeeBookings
            ? Booking::whereIn('centre_id', $ids)->with('centre:id,name', 'floor:id,name', 'bookingDates')
                ->latest()->paginate(50)->through($toRow)
            : null;
        $todayBookings = $canSeeBookings
            ? Booking::whereIn('centre_id', $ids)
                ->where(fn ($query) => $query->whereDate('event_date', $today)
                    ->orWhereHas('bookingDates', fn ($dates) => $dates->whereDate('date', $today)))
                ->with('centre:id,name', 'floor:id,name', 'bookingDates')
                ->orderBy('session_type')->get()->map($toRow)
            : collect();

        return response()->json(['data' => [
            'centres' => $centres,
            'bookings' => $bookings,
            'today_bookings' => $todayBookings,
            'today' => $today,
            'permissions' => $user->coordinator_permissions ?? [],
        ]]);
    }

    public function storeBooking(Request $request, BookingService $service)
    {
        abort_unless($request->user()->hasCoordinatorPermission('bookings.create'), 403);
        $data = $request->validate([
            'centre_slug' => ['required', 'string', 'exists:community_centres,slug'],
            'centre_floor_id' => ['nullable', 'integer', 'exists:centre_floors,id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', 'string', 'regex:/^01[0-9]{9}$/'],
            'event_date' => ['required', 'date', 'after_or_equal:today'],
            'session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
            'guest_count' => ['required', 'integer', 'min:1'],
            'event_type' => ['nullable', 'string', 'max:255'],
            'event_manager_name' => ['nullable', 'required_with:event_manager_phone', 'string', 'max:255'],
            'event_manager_phone' => ['nullable', 'required_with:event_manager_name', 'regex:/^01[0-9]{9}$/'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'booking_dates' => ['nullable', 'array', 'min:1', 'max:30'],
            'booking_dates.*.date' => ['required', 'date', 'after_or_equal:today', 'distinct'],
            'booking_dates.*.session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
        ]);

        $centre = CommunityCentre::where('slug', $data['centre_slug'])->firstOrFail();
        abort_unless($request->user()->coordinatesCentre($centre->id), 403);

        $booking = DB::transaction(function () use ($centre, $data, $service) {
            $booking = $service->create($centre, $data);
            $booking->update(['status' => 'payment_pending']);

            return $booking->fresh();
        });

        return (new BookingResource($booking->load('centre', 'payment', 'foodItems', 'bookingDates')))
            ->response()->setStatusCode(201);
    }

    public function updateBookingNote(Request $request, string $bookingNo)
    {
        abort_unless($request->user()->hasCoordinatorPermission('bookings.note'), 403);
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);
        $booking = Booking::where('booking_no', $bookingNo)->firstOrFail();
        abort_unless($request->user()->coordinatesCentre($booking->centre_id), 403);
        $booking->update(['notes' => $data['notes'] ?? null]);

        return response()->json(['message' => 'Note saved.', 'notes' => $booking->notes]);
    }

    public function verifyCompletion(Request $request, string $bookingNo)
    {
        $user = $request->user();
        abort_unless($user->hasCoordinatorPermission('bookings.view')
            && $user->hasCoordinatorPermission('bookings.verify'), 403);

        $booking = DB::transaction(function () use ($user, $bookingNo) {
            $booking = Booking::where('booking_no', $bookingNo)->with('bookingDates')
                ->lockForUpdate()->firstOrFail();
            abort_unless($user->coordinatesCentre($booking->centre_id), 403);
            abort_unless($booking->status === 'completed', 422,
                'The owner must mark this booking completed first.');
            abort_unless((float) $booking->due_amount <= 0, 422,
                'Settle the remaining balance before verifying completion.');
            abort_unless($booking->completion_verified_at === null, 422,
                'This booking has already been verified.');

            $lastDate = $booking->bookingDates->max(fn ($slot) => $slot->date?->format('Y-m-d'))
                ?? $booking->event_date?->format('Y-m-d');
            abort_unless($lastDate !== null && $lastDate <= now('Asia/Dhaka')->toDateString(), 422,
                'The final event date has not arrived yet.');

            $booking->update([
                'completion_verified_by' => $user->id,
                'completion_verified_at' => now(),
            ]);

            return $booking;
        });

        return response()->json([
            'message' => 'Event completion verified.',
            'status' => $booking->status,
            'completion_verified_at' => $booking->completion_verified_at?->toIso8601String(),
        ]);
    }
}
