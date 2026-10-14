<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CentreReview;
use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\SoftwareFeedback;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FeedbackController extends Controller
{
    public function centreReviews(CommunityCentre $centre)
    {
        $reviews = CentreReview::where('centre_id', $centre->id)
            ->with('user:id,name')
            ->latest()
            ->paginate(10);

        return response()->json(['data' => $reviews->getCollection()->map(fn ($review) => [
            'id' => $review->id,
            'name' => $review->user?->name,
            'rating' => $review->rating,
            'comment' => $review->comment,
            'created_at' => $review->created_at->toDateString(),
        ]), 'next_page_url' => $reviews->nextPageUrl()]);
    }

    public function storeCentreReview(Request $request, CommunityCentre $centre)
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['required', 'string', 'min:10', 'max:1000'],
        ]);
        $user = $request->user();
        if (! $centre->bookings()->where('user_id', $user->id)->where('status', 'completed')->exists()) {
            return response()->json(['message' => 'Only customers with a completed booking at this centre can review it.'], 403);
        }

        DB::transaction(function () use ($centre, $user, $data) {
            CentreReview::updateOrCreate(
                ['centre_id' => $centre->id, 'user_id' => $user->id],
                $data
            );
            $centre->update(['rating' => round((float) CentreReview::where('centre_id', $centre->id)->avg('rating'), 2)]);
        });

        return response()->json(['message' => 'Review saved.'], 201);
    }

    public function storeSoftwareFeedback(Request $request)
    {
        $isBookingFeedback = $request->filled('booking_no');
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => $isBookingFeedback
                ? ['nullable', 'string', 'max:2000']
                : ['required', 'string', 'min:10', 'max:2000'],
            'booking_no' => ['nullable', 'string', 'max:50'],
        ]);
        if ($isBookingFeedback) {
            $booking = Booking::where('booking_no', $data['booking_no'])->firstOrFail();
            abort_unless($request->user()->role === 'customer'
                && $booking->user_id === $request->user()->id, 403,
                'You can only rate the software for your own booking.');
            SoftwareFeedback::updateOrCreate(
                ['booking_id' => $booking->id],
                ['user_id' => $request->user()->id, 'rating' => $data['rating'], 'comment' => $data['comment'] ?? null]
            );
        } else {
            SoftwareFeedback::create(['user_id' => $request->user()->id, ...$data]);
        }

        return response()->json(['message' => 'Thank you for your feedback.'], 201);
    }

    public function bookingSoftwareFeedback(Request $request, string $bookingNo)
    {
        $booking = Booking::where('booking_no', $bookingNo)->firstOrFail();
        abort_unless($request->user()->role === 'customer'
            && $booking->user_id === $request->user()->id, 403);
        $feedback = SoftwareFeedback::where('booking_id', $booking->id)->first();

        return response()->json(['data' => $feedback ? [
            'rating' => $feedback->rating,
            'comment' => $feedback->comment,
        ] : null]);
    }

    public function adminSoftwareFeedback()
    {
        return response()->json(['data' => SoftwareFeedback::with('user:id,name,phone', 'booking:id,booking_no')
            ->latest()->paginate(30)]);
    }
}
