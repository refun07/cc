<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\User;
use App\Services\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CaretakerController extends Controller
{
    public function overview(Request $request)
    {
        $user = $request->user();
        $ids = $user->assignedCentreIds();
        $centres = \App\Models\CommunityCentre::whereIn('id', $ids)->get(['id', 'name', 'area', 'working_area']);
        $centre = $centres->first();
        abort_unless($centre, 403, 'No centre has been assigned to this caretaker.');

        $today = now('Asia/Dhaka')->toDateString();
        $bookings = Booking::whereIn('centre_id', $ids)
            ->whereDate('event_date', '<=', $today)
            ->whereIn('status', ['payment_pending', 'confirmed', 'paid', 'completed'])
            ->with('centre:id,name', 'floor:id,name', 'bookingDates', 'completionReport')
            ->orderByDesc('event_date')->get()
            ->filter(fn ($booking) => $this->lastDate($booking) <= $today)
            ->map(fn ($booking) => $this->row($booking))
            ->values();

        return response()->json(['data' => [
            'centre' => $centre->only(['id', 'name', 'area', 'working_area']),
            'centres' => $centres,
            'today' => $today,
            'today_bookings' => $bookings->filter(fn ($row) => $row['last_event_date'] === $today)->values(),
            'pending_reports' => $bookings->filter(fn ($row) => $row['report'] === null)->values(),
            'reported' => $bookings->filter(fn ($row) => $row['report'] !== null)->values(),
        ]]);
    }

    public function storeReport(Request $request, string $bookingNo)
    {
        $data = $request->validate([
            'outcome' => ['required', Rule::in(['completed', 'not_completed'])],
            'notes' => ['nullable', 'string', 'max:2000', Rule::requiredIf(fn () => $request->input('outcome') === 'not_completed')],
        ]);
        $user = $request->user();
        abort_unless($user->assignedCentreIds()->isNotEmpty(), 403, 'No centre has been assigned to this caretaker.');

        $report = DB::transaction(function () use ($bookingNo, $user, $data) {
            $booking = Booking::where('booking_no', $bookingNo)->with('bookingDates')
                ->lockForUpdate()->firstOrFail();
            abort_unless($user->coordinatesCentre($booking->centre_id), 403);
            abort_unless(in_array($booking->status, ['payment_pending', 'confirmed', 'paid', 'completed'], true), 422,
                'Only accepted bookings can be reported as an event.');
            abort_unless($this->lastDate($booking) <= now('Asia/Dhaka')->toDateString(), 422,
                'The final event date has not arrived yet.');
            abort_unless(! $booking->completionReport()->exists(), 422,
                'This booking already has a caretaker report.');

            $report = $booking->completionReport()->create([
                'centre_id' => $booking->centre_id,
                'caretaker_id' => $user->id,
                'outcome' => $data['outcome'],
                'notes' => $data['notes'] ?? null,
                'reported_at' => now(),
            ]);
            if ($data['outcome'] === 'completed' && $booking->status !== 'completed') {
                $booking->update(['status' => 'completed']);
            }

            return $report->load('booking', 'centre');
        });

        $summary = "{$report->booking->booking_no}: {$report->outcome} at {$report->centre->name}";
        User::where('role', 'area_admin')->where('status', 'active')
            ->where('area_scope', $report->centre->working_area)->pluck('id')
            ->each(fn ($id) => Notify::send($id, 'Caretaker event report', $summary, 'booking', '/area/event-reports'));
        Notify::admins('Caretaker event report', $summary, 'booking', '/admin/event-reports');
        if ($report->outcome === 'completed') {
            Notify::send($report->booking->user_id, 'Booking completed',
                "Your booking {$report->booking->booking_no} is now completed.", 'booking', '/my-bookings');
        }

        return response()->json(['data' => $report->load('caretaker:id,name')], 201);
    }

    public function reports(Request $request)
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'area_admin'], true), 403);
        abort_if($user->role === 'area_admin' && blank($user->area_scope), 403);

        $today = now('Asia/Dhaka')->toDateString();
        $assignedCentreIds = User::where('role', 'caretaker')->where('status', 'active')
            ->get()->flatMap(fn ($user) => $user->assignedCentreIds())->unique();
        $bookings = Booking::whereDate('event_date', '<=', $today)
            ->whereIn('status', ['payment_pending', 'confirmed', 'paid', 'completed'])
            ->where(fn ($query) => $query->whereIn('centre_id', $assignedCentreIds)
                ->orWhereHas('completionReport'))
            ->when($user->role === 'area_admin', fn ($query) => $query->whereHas('centre',
                fn ($centre) => $centre->where('working_area', $user->area_scope)))
            ->with('centre:id,name,area,working_area', 'floor:id,name', 'bookingDates', 'completionReport.caretaker:id,name')
            ->orderByDesc('event_date')->get()
            ->filter(fn ($booking) => $this->lastDate($booking) <= $today)
            ->map(fn ($booking) => $this->row($booking) + [
                'centre' => $booking->centre?->name,
                'area' => $booking->centre?->area,
                'working_area' => $booking->centre?->working_area,
            ])->values();

        return response()->json(['data' => [
            'pending_count' => $bookings->filter(fn ($row) => $row['report'] === null)->count(),
            'reported_count' => $bookings->filter(fn ($row) => $row['report'] !== null)->count(),
            'rows' => $bookings,
        ]]);
    }

    private function lastDate(Booking $booking): string
    {
        return $booking->bookingDates->max(fn ($slot) => $slot->date?->format('Y-m-d'))
            ?? $booking->event_date?->format('Y-m-d') ?? '';
    }

    private function row(Booking $booking): array
    {
        $report = $booking->completionReport;

        return [
            'booking_no' => $booking->booking_no,
            'centre_name' => $booking->centre?->name,
            'event_date' => $booking->event_date?->format('Y-m-d'),
            'last_event_date' => $this->lastDate($booking),
            'session_type' => $booking->session_type,
            'floor' => $booking->floor?->name,
            'customer_name' => $booking->customer_name,
            'status' => $booking->status,
            'report' => $report ? [
                'outcome' => $report->outcome,
                'notes' => $report->notes,
                'reported_at' => $report->reported_at?->toIso8601String(),
                'caretaker' => $report->caretaker?->name,
            ] : null,
        ];
    }
}
