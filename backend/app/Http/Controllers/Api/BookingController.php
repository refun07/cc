<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Services\BookingService;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    public function __construct(protected BookingService $bookings) {}

    /** Live price quote without persisting. */
    public function quote(Request $request)
    {
        $data = $request->validate([
            'centre_slug' => ['required', 'exists:community_centres,slug'],
            'session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
            'guest_count' => ['required', 'integer', 'min:1'],
            'food_selections' => ['nullable', 'array'],
            'food_selections.*.food_menu_id' => ['required', 'integer', 'distinct'],
            'food_selections.*.quantity' => ['nullable', 'integer', 'min:1'],
            'adjustment_amount' => ['nullable', 'numeric', 'between:-1000000,1000000'],
            'booking_dates' => ['nullable', 'array', 'min:1', 'max:30'],
            'booking_dates.*.date' => ['required', 'date', 'after_or_equal:today', 'distinct'],
            'booking_dates.*.session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
        ]);

        $centre = CommunityCentre::where('slug', $data['centre_slug'])->firstOrFail();
        $quote = $this->bookings->quote(
            $centre,
            $data['session_type'],
            (int) $data['guest_count'],
            $data['food_selections'] ?? [],
            (float) ($data['adjustment_amount'] ?? 0),
            $data['booking_dates'] ?? []
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
            'customer_email' => $request->input('customer_email') ?: $user->email,
        ]);

        $booking = $this->bookings->create($centre, $data);
        $booking->update(['status' => 'payment_pending']);

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

        if (in_array($booking->status, ['cancelled', 'completed', 'refunded'], true)) {
            return response()->json(['message' => 'This booking can no longer be cancelled.'], 422);
        }

        $booking = $this->bookings->cancelAndRefund(
            $booking,
            $data['reason'] ?? null,
            isset($data['refund_amount']) ? (float) $data['refund_amount'] : null
        );

        return new BookingResource($booking->load('foodItems', 'bookingDates', 'centre', 'payment'));
    }

    public function show(string $bookingNo)
    {
        $booking = Booking::where('booking_no', $bookingNo)
            ->with('foodItems', 'bookingDates', 'centre', 'payment')
            ->firstOrFail();

        return new BookingResource($booking);
    }
}
