<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(protected BookingService $bookings) {}

    /**
     * Simulate initiating + confirming a local-gateway payment.
     * Supports paying the full amount or a confirmation advance.
     * In production this would redirect to bKash/Nagad/SSLCommerz and verify a callback.
     */
    public function initiate(Request $request)
    {
        $data = $request->validate([
            'booking_no' => ['required', 'exists:bookings,booking_no'],
            'payment_method' => ['required', 'string', 'max:50'],
            'payment_option' => ['nullable', 'in:full,advance'],
            'custom_payment_amount' => ['nullable', 'numeric', 'gt:0'],
        ]);

        $booking = Booking::where('booking_no', $data['booking_no'])->firstOrFail();
        $type = $data['payment_option'] ?? $booking->payment_option ?? 'full';

        $payment = $this->bookings->applyPayment(
            $booking,
            $data['payment_method'],
            $type,
            isset($data['custom_payment_amount']) ? (float) $data['custom_payment_amount'] : null
        );

        $booking->loadMissing('centre');
        \App\Services\Notify::send($booking->centre?->owner_id, 'Payment received',
            "{$booking->customer_name} paid {$payment->amount} for {$booking->booking_no}.", 'payment', '/owner/bookings');
        \App\Services\Notify::send($booking->user_id, 'Booking confirmed',
            "Your booking {$booking->booking_no} is confirmed. See you on {$booking->event_date->format('d M Y')}!", 'booking', '/my-bookings');

        return response()->json([
            'data' => new BookingResource($booking->fresh()->load('foodItems', 'bookingDates', 'centre', 'payment')),
            'transaction_id' => $payment->transaction_id,
        ]);
    }
}
