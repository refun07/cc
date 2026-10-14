<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WasteStream;
use App\Services\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WasteRequestController extends Controller
{
    private function scoped(Request $request)
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['caretaker', 'area_admin', 'admin'], true), 403);
        abort_if($user->role === 'caretaker' && $user->assignedCentreIds()->isEmpty(), 403);
        abort_if($user->role === 'area_admin' && blank($user->area_scope), 403);

        return WasteStream::query()->whereNotNull('requested_by')
            ->when($user->role === 'caretaker', fn ($q) => $q->whereIn('centre_id', $user->assignedCentreIds()))
            ->when($user->role === 'area_admin', fn ($q) => $q->whereHas('centre', fn ($c) => $c->where('working_area', $user->area_scope)));
    }

    public function index(Request $request)
    {
        $query = $this->scoped($request);
        $data = $request->validate(['scope' => ['nullable', Rule::in(['requested', 'assigned', 'completed'])]]);
        $scope = $data['scope'] ?? 'requested';
        return response()->json(['data' => [
            'centres' => $request->user()->role === 'caretaker' ? \App\Models\CommunityCentre::whereIn('id', $request->user()->assignedCentreIds())->get(['id', 'name']) : [],
            'counts' => [
                'requested' => (clone $query)->where('status', 'sorting_required')->count(),
                'assigned' => (clone $query)->where('status', 'pickup_assigned')->count(),
                'completed' => (clone $query)->whereNotNull('collection_confirmed_by')->count(),
            ],
            'partners' => $request->user()->role === 'caretaker' ? [] : User::where('role', 'waste_partner')->where('status', 'active')->get(['id', 'name', 'phone']),
            'requests' => $query
                ->when($scope === 'requested', fn ($q) => $q->where('status', 'sorting_required'))
                ->when($scope === 'assigned', fn ($q) => $q->where('status', 'pickup_assigned'))
                ->when($scope === 'completed', fn ($q) => $q->whereNotNull('collection_confirmed_by'))
                ->with('centre:id,name,working_area', 'partner:id,name,phone', 'requester:id,name', 'assigner:id,name', 'collectionConfirmer:id,name')
                ->latest()->paginate(20),
        ]]);
    }

    public function store(Request $request)
    {
        $this->scoped($request);
        abort_unless($request->user()->role === 'caretaker', 403);
        $data = $request->validate([
            'centre_id' => ['sometimes', 'integer', Rule::in($request->user()->assignedCentreIds()->all())],
            'waste_type' => ['required', 'string', 'max:100'],
            'quantity' => ['required', 'numeric', 'min:0.01', 'max:999999'],
            'unit' => ['required', Rule::in(['kg', 'pcs'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        abort_if(! isset($data['centre_id']) && $request->user()->assignedCentreIds()->count() > 1, 422, 'Select the centre for this request.');
        $waste = WasteStream::create($data + [
            'centre_id' => $request->user()->assignedCentreIds()->first(),
            'requested_by' => $request->user()->id,
            'status' => 'sorting_required',
        ]);
        $this->notifyOffice($waste, 'Waste collection requested');
        return response()->json(['data' => $waste], 201);
    }

    public function assign(Request $request, int $id)
    {
        abort_unless(in_array($request->user()->role, ['area_admin', 'admin'], true), 403);
        $data = $request->validate([
            'partner_id' => ['required', 'integer', Rule::exists('users', 'id')->where('role', 'waste_partner')->where('status', 'active')],
            'pickup_scheduled_for' => ['required', 'date', 'after:now'],
        ]);
        $waste = DB::transaction(function () use ($request, $id, $data) {
            $waste = $this->scoped($request)->lockForUpdate()->findOrFail($id);
            abort_unless($waste->status === 'sorting_required', 422, 'This request has already been assigned.');
            $waste->update([
                'assigned_partner_id' => $data['partner_id'],
                'assigned_by' => $request->user()->id,
                'pickup_scheduled_for' => $data['pickup_scheduled_for'],
                'status' => 'pickup_assigned',
            ]);
            return $waste;
        });
        Notify::send($waste->assigned_partner_id, 'New pickup assigned', $waste->waste_type, 'waste', '/partner/pickups');
        User::caretakersForCentre($waste->centre_id)->pluck('id')
            ->each(fn ($id) => Notify::send($id, 'Waste partner assigned', $waste->waste_type, 'waste', '/caretaker/waste'));
        $this->notifyOffice($waste, 'Waste partner assigned');
        return response()->json(['data' => $waste]);
    }

    public function complete(Request $request, int $id)
    {
        abort_unless($request->user()->role === 'caretaker', 403);
        $data = $request->validate(['confirmed' => ['required', 'accepted'], 'notes' => ['nullable', 'string', 'max:2000']]);
        $waste = DB::transaction(function () use ($request, $id, $data) {
            $waste = $this->scoped($request)->lockForUpdate()->findOrFail($id);
            abort_unless($waste->status === 'pickup_assigned' && $waste->assigned_partner_id, 422, 'Only assigned pickups can be confirmed.');
            $waste->update([
                'status' => 'collected', 'collected_at' => now(),
                'collection_confirmed_by' => $request->user()->id,
                'collection_notes' => $data['notes'] ?? null,
            ]);
            return $waste;
        });
        $this->notifyOffice($waste, 'Waste collection confirmed');
        Notify::send($waste->assigned_partner_id, 'Waste collection confirmed', $waste->waste_type, 'waste', '/partner/pickups');
        return response()->json(['data' => $waste]);
    }

    private function notifyOffice(WasteStream $waste, string $title): void
    {
        $message = "{$waste->centre->name}: {$waste->waste_type} ({$waste->quantity} {$waste->unit})";
        User::where('role', 'area_admin')->where('status', 'active')->where('area_scope', $waste->centre->working_area)->pluck('id')
            ->each(fn ($id) => Notify::send($id, $title, $message, 'waste', '/area/waste-delays'));
        Notify::admins($title, $message, 'waste', '/admin/waste-delays');
    }
}
