<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\CommunityCentre;
use App\Models\CrmActivity;
use App\Models\CrmContact;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CrmController extends Controller
{
    protected function centreIds(Request $request)
    {
        return CommunityCentre::where('owner_id', $request->user()->id)->pluck('id');
    }

    protected function ownContact(Request $request, CrmContact $contact): CrmContact
    {
        abort_unless($this->centreIds($request)->contains($contact->centre_id), 403, 'This contact does not belong to your centre.');

        return $contact;
    }

    public function index(Request $request)
    {
        $ids = $this->centreIds($request);
        $base = CrmContact::whereIn('centre_id', $ids);
        $contacts = (clone $base)
            ->with('centre:id,name')
            ->withCount('activities')
            ->when($request->query('stage'), fn ($q, $stage) => $q->where('stage', $stage))
            ->when($request->query('q'), fn ($q, $search) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")))
            ->orderByRaw('next_follow_up_at is null, next_follow_up_at asc')
            ->latest('updated_at')
            ->limit(200)
            ->get();

        $bookingStats = Booking::whereIn('centre_id', $ids)
            ->selectRaw('centre_id, customer_phone, count(*) as booking_count, sum(paid_amount) as lifetime_value, max(event_date) as last_booking_date')
            ->groupBy('centre_id', 'customer_phone')
            ->get()
            ->keyBy(fn ($row) => $row->centre_id.'|'.$row->customer_phone);

        $contacts->each(function ($contact) use ($bookingStats) {
            $stats = $bookingStats->get($contact->centre_id.'|'.$contact->phone);
            $contact->setAttribute('booking_count', (int) ($stats?->booking_count ?? 0));
            $contact->setAttribute('lifetime_value', (float) ($stats?->lifetime_value ?? 0));
            $contact->setAttribute('last_booking_date', $stats?->last_booking_date);
        });

        return response()->json([
            'summary' => [
                'total' => (clone $base)->count(),
                'new_leads' => (clone $base)->where('stage', 'new')->count(),
                'active_pipeline' => (clone $base)->whereIn('stage', ['contacted', 'qualified', 'proposal'])->count(),
                'customers' => (clone $base)->whereIn('stage', ['won', 'customer'])->count(),
                'followups_due' => (clone $base)->whereNotNull('next_follow_up_at')->where('next_follow_up_at', '<=', now()->endOfDay())->count(),
                'lifetime_value' => (float) Booking::whereIn('centre_id', $ids)->sum('paid_amount'),
            ],
            'data' => $contacts,
        ]);
    }

    public function show(Request $request, CrmContact $contact)
    {
        $this->ownContact($request, $contact);
        $contact->load(['centre:id,name', 'activities.creator:id,name']);
        $bookings = Booking::where('centre_id', $contact->centre_id)->where('customer_phone', $contact->phone)
            ->with('bookingDates')->latest()->limit(20)->get(['id', 'booking_no', 'centre_id', 'customer_phone', 'event_date', 'session_type', 'total_amount', 'paid_amount', 'status']);

        return response()->json(['data' => $contact, 'bookings' => $bookings]);
    }

    public function store(Request $request)
    {
        $centre = CommunityCentre::where('owner_id', $request->user()->id)
            ->when($request->input('centre_id'), fn ($q, $id) => $q->where('id', $id))->firstOrFail();
        $data = $this->validateContact($request, $centre->id);
        $data['centre_id'] = $centre->id;
        $data['assigned_to'] = $request->user()->id;

        return response()->json(['data' => CrmContact::create($data)], 201);
    }

    public function update(Request $request, CrmContact $contact)
    {
        $this->ownContact($request, $contact);
        $contact->update($this->validateContact($request, $contact->centre_id, $contact->id));

        return response()->json(['data' => $contact->fresh('centre:id,name')]);
    }

    public function destroy(Request $request, CrmContact $contact)
    {
        $this->ownContact($request, $contact)->delete();

        return response()->json(['message' => 'Contact removed.']);
    }

    public function storeActivity(Request $request, CrmContact $contact)
    {
        $this->ownContact($request, $contact);
        $data = $request->validate([
            'type' => ['required', 'in:call,whatsapp,email,meeting,note,follow_up'],
            'subject' => ['nullable', 'string', 'max:255'],
            'details' => ['nullable', 'string', 'max:5000'],
            'occurred_at' => ['nullable', 'date'],
            'next_follow_up_at' => ['nullable', 'date'],
        ]);
        $data['created_by'] = $request->user()->id;
        $data['occurred_at'] = $data['occurred_at'] ?? now();
        $activity = $contact->activities()->create($data);
        $contact->update([
            'last_contacted_at' => $data['occurred_at'],
            'next_follow_up_at' => $data['next_follow_up_at'] ?? $contact->next_follow_up_at,
            'stage' => $contact->stage === 'new' ? 'contacted' : $contact->stage,
        ]);

        return response()->json(['data' => $activity->load('creator:id,name'), 'contact' => $contact->fresh()], 201);
    }

    protected function validateContact(Request $request, int $centreId, ?int $ignoreId = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30', Rule::unique('crm_contacts')->where('centre_id', $centreId)->ignore($ignoreId)],
            'email' => ['nullable', 'email', 'max:255'],
            'stage' => ['nullable', 'in:new,contacted,qualified,proposal,won,lost,customer'],
            'source' => ['nullable', 'string', 'max:100'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'next_follow_up_at' => ['nullable', 'date'],
        ]);
    }
}
