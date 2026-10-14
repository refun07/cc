<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\CommunityCentre;
use Illuminate\Http\Request;

class AreaAdminController extends Controller
{
    public function overview(Request $request)
    {
        $area = $request->user()->area_scope;
        abort_if(blank($area), 403, 'No area has been assigned to this account.');

        $centres = CommunityCentre::where('working_area', $area)
            ->withCount('bookings')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'area', 'working_area', 'status', 'capacity', 'cover_image']);
        $bookings = Booking::whereIn('centre_id', $centres->pluck('id'))
            ->with('centre:id,name,area', 'floor:id,name')
            ->latest()
            ->paginate(50)
            ->through(fn ($booking) => [
                'booking_no' => $booking->booking_no,
                'centre' => $booking->centre?->name,
                'floor' => $booking->floor?->name,
                'event_date' => $booking->event_date?->format('Y-m-d'),
                'session_type' => $booking->session_type,
                'customer_name' => $booking->customer_name,
                'customer_phone' => $booking->customer_phone,
                'status' => $booking->status,
            ]);

        return response()->json(['data' => [
            'area' => $area,
            'working_area' => $area,
            'centres' => $centres,
            'bookings' => $bookings,
        ]]);
    }
}
