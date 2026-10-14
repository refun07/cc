<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Services\BookingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingController extends Controller
{
    public function __construct(protected BookingService $bookings) {}

    /** Live price quote without persisting. */
    public function quote(Request $request)
    {
        $data = $request->validate([
            'centre_slug' => ['required', 'exists:community_centres,slug'],
            'centre_floor_id' => ['nullable', 'integer', 'exists:centre_floors,id'],
            'session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
            'guest_count' => ['required', 'integer', 'min:1'],
            'adjustment_amount' => ['nullable', 'numeric', 'between:-1000000,1000000'],
            'booking_dates' => ['nullable', 'array', 'min:1', 'max:30'],
            'booking_dates.*.date' => ['required', 'date', 'after_or_equal:today', 'distinct'],
            'booking_dates.*.session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
        ]);

        $centre = CommunityCentre::where('slug', $data['centre_slug'])->firstOrFail();
        // Preview only: a floor is optional here (the customer may not have picked one yet).
        $floor = ! empty($data['centre_floor_id'])
            ? $centre->activeFloors()->whereKey($data['centre_floor_id'])->first()
            : null;
        $quote = $this->bookings->quote(
            $centre,
            $data['session_type'],
            (int) $data['guest_count'],
            [],
            (float) ($data['adjustment_amount'] ?? 0),
            $data['booking_dates'] ?? [],
            $floor
        );

        return response()->json(['data' => $quote]);
    }

    public function store(StoreBookingRequest $request)
    {
        $centre = CommunityCentre::where('slug', $request->centre_slug)->firstOrFail();

        // Identity comes from the signed-in account; phone is the account's verified number.
        $user = $request->user();
        $data = array_merge($request->validated(), [
            'user_id' => $user->id,
            'customer_name' => $request->input('customer_name') ?: $user->name,
            'customer_phone' => $user->phone,
            'customer_email' => null,
            'payment_option' => $request->input('payment_option') ?? 'full',
            'payment_method' => $request->input('payment_method') === 'Cash' ? 'Cash' : 'ekPay',
        ]);

        $booking = DB::transaction(function () use ($centre, $data, $user) {
            $booking = $this->bookings->create($centre, $data);
            $booking->update(['status' => 'payment_pending']);
            if (! \App\Rules\PlausibleNid::accepts($user->nid_number)) {
                $user->update(['nid_number' => $data['nid_number']]);
            }
            return $booking;
        });

        \App\Services\Notify::send($centre->owner_id, 'New booking request',
            "{$booking->customer_name} requested {$centre->name} on {$booking->event_date->format('d M Y')}.",
            'booking', '/owner/bookings');

        return (new BookingResource($booking->load('foodItems', 'bookingDates', 'centre', 'payment')))
            ->response()
            ->setStatusCode(201);
    }

    public function myBookings(Request $request)
    {
        $bookings = Booking::where('user_id', $request->user()->id)
            ->with('centre', 'payment', 'foodItems', 'bookingDates')
            ->latest()
            ->get();

        return BookingResource::collection($bookings);
    }

    public function cancel(Request $request, string $bookingNo)
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $booking = Booking::where('booking_no', $bookingNo)
            ->with('payment', 'centre')
            ->firstOrFail();

        if ($booking->user_id !== $request->user()->id) {
            return response()->json(['message' => 'You can only cancel your own bookings.'], 403);
        }

        // Once a centre or admin has confirmed (or fully paid) a booking, it is locked in
        // and can no longer be self-cancelled by the customer.
        if (in_array($booking->status, ['confirmed', 'paid', 'cancelled', 'completed', 'refunded'], true)) {
            return response()->json(['message' => 'This booking is confirmed and can no longer be cancelled online. Please contact the centre.'], 422);
        }
        if ($booking->paymentAttempts()->whereIn('status', ['initiating', 'pending'])->exists()) {
            return response()->json(['message' => 'A payment is in progress. Please wait for confirmation before cancelling.'], 422);
        }

        $booking = $this->bookings->cancelAndRefund(
            $booking,
            $data['reason'] ?? null,
            isset($data['refund_amount']) ? (float) $data['refund_amount'] : null
        );

        return new BookingResource($booking->load('foodItems', 'bookingDates', 'centre', 'payment'));
    }

    /**
     * Let the booking owner amend their contact & event details before the event.
     */
    public function updateDetails(Request $request, string $bookingNo)
    {
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'guest_count' => ['nullable', 'integer', 'min:1'],
            'event_type' => ['nullable', 'string', 'max:255'],
            'event_manager_name' => ['nullable', 'required_with:event_manager_phone', 'string', 'max:255'],
            'event_manager_phone' => ['nullable', 'required_with:event_manager_name', 'regex:/^01[0-9]{9}$/'],
        ]);

        $booking = Booking::where('booking_no', $bookingNo)->firstOrFail();

        if ($booking->user_id !== $request->user()->id) {
            return response()->json(['message' => 'You can only edit your own bookings.'], 403);
        }
        if (in_array($booking->status, ['cancelled', 'completed', 'refunded'], true)) {
            return response()->json(['message' => 'This booking can no longer be edited.'], 422);
        }

        if (isset($data['guest_count'])) {
            $this->bookings->assertGuestCapacity($booking->centre, (int) $data['guest_count'], $booking->floor);
        }

        $booking->update(array_merge(
            array_filter($data, fn ($v) => $v !== null),
            array_intersect_key($data, array_flip(['event_manager_name', 'event_manager_phone']))
        ));

        return new BookingResource($booking->fresh()->load('foodItems', 'bookingDates', 'centre', 'payment'));
    }

    public function show(Request $request, string $bookingNo)
    {
        $booking = Booking::where('booking_no', $bookingNo)
            ->with('foodItems', 'bookingDates', 'centre', 'payment')
            ->firstOrFail();

        $user = $request->user();
        $canView = $user->role === 'admin'
            || $booking->user_id === $user->id
            || ($user->role === 'owner' && $booking->centre?->owner_id === $user->id)
            || ($user->role === 'area_admin' && filled($user->area_scope) && $booking->centre?->working_area === $user->area_scope);
        $canView = $canView || ($user->hasCoordinatorPermission('bookings.view') && $user->coordinatesCentre($booking->centre_id));
        abort_unless($canView, 403, 'You cannot view this booking.');

        return new BookingResource($booking);
    }
}
