<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\PaymentAttempt;
use App\Models\User;
use App\Services\BookingService;
use App\Services\EkpayGateway;
use App\Services\EkpayPayments;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(private EkpayPayments $ekpay, private BookingService $bookings) {}

    public function availability(Request $request, EkpayGateway $gateway)
    {
        $token = $request->bearerToken();
        $user = $token ? User::where('api_token', $token)->first() : null;

        return response()->json(['online_available' => $gateway->availableTo($user)]);
    }

    public function initiate(Request $request)
    {
        $data = $request->validate([
            'booking_no' => ['required', 'string', 'exists:bookings,booking_no'],
            'payment_option' => ['nullable', 'in:full,advance'],
        ]);
        $booking = Booking::where('booking_no', $data['booking_no'])->firstOrFail();
        abort_unless($booking->user_id === $request->user()->id, 403);

        return response()->json([
            'redirect_url' => $this->ekpay->start($booking, $data['payment_option'] ?? 'full'),
        ]);
    }

    public function ipn(Request $request)
    {
        $transactionId = $request->input('trnx_info.mer_trnx_id');
        if (! is_string($transactionId) || ! preg_match('/^(?:DSCC[A-Z0-9]{24}|ICCMS[A-Z0-9]{23})$/', $transactionId)) {
            return response()->json(['ack_code' => 'ack002', 'ack_msg' => 'Invalid transaction'], 422);
        }

        $attempt = PaymentAttempt::where('transaction_id', $transactionId)->first();
        if (! $attempt) {
            return response()->json(['ack_code' => 'ack002', 'ack_msg' => 'Unknown transaction'], 404);
        }
        $this->ekpay->reconcile($attempt);

        return response()->json([
            'ack_code' => 'ack001',
            'ack_msg' => 'Notification received',
            'ack_timestamp' => now('Asia/Dhaka')->format('Y-m-d H:i:s').' GMT+6',
        ]);
    }

    public function returnFromGateway(Request $request, string $outcome)
    {
        abort_unless(in_array($outcome, ['success', 'failure', 'cancel'], true), 404);
        $transactionId = $request->query('trnsId');
        abort_unless(is_string($transactionId) && preg_match('/^(?:DSCC[A-Z0-9]{24}|ICCMS[A-Z0-9]{23})$/', $transactionId), 404);
        $attempt = PaymentAttempt::where('transaction_id', $transactionId)->firstOrFail();
        $status = $this->ekpay->reconcile($attempt);

        return redirect('/booking/'.$attempt->booking->booking_no.'?payment='.
            ($status === 'paid' ? 'paid' : 'pending'));
    }

    public function recordOffline(Request $request)
    {
        $data = $request->validate([
            'booking_no' => ['required', 'string', 'exists:bookings,booking_no'],
            'payment_method' => ['required', 'in:Cash,Bank Transfer'],
            'custom_payment_amount' => ['nullable', 'numeric', 'gt:0'],
            'request_key' => ['required', 'uuid'],
        ]);
        $booking = Booking::where('booking_no', $data['booking_no'])->firstOrFail();
        abort_unless($booking->centre?->owner_id === $request->user()->id, 403);

        $payment = $this->bookings->applyPayment(
            $booking,
            $data['payment_method'],
            'full',
            isset($data['custom_payment_amount']) ? (float) $data['custom_payment_amount'] : null,
            $data['request_key']
        );
        return response()->json([
            'data' => new BookingResource($booking->fresh()->load('foodItems', 'bookingDates', 'centre', 'payment')),
            'transaction_id' => $payment->transaction_id,
        ]);
    }
}
