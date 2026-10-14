<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WasteStream;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WasteDelayController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'area_admin'], true), 403);
        abort_if($user->role === 'area_admin' && blank($user->area_scope), 403);

        $data = $request->validate(['scope' => ['nullable', Rule::in(['overdue', 'collected_late', 'all'])]]);
        $scope = $data['scope'] ?? 'overdue';
        $base = WasteStream::query()
            ->whereNotNull('assigned_partner_id')
            ->whereNotNull('pickup_scheduled_for')
            ->when($user->role === 'area_admin', fn ($query) => $query->whereHas('centre',
                fn ($centre) => $centre->where('working_area', $user->area_scope)));

        $overdue = fn ($query) => $query->where('status', 'pickup_assigned')
            ->where('pickup_scheduled_for', '<', now());
        $collectedLate = fn ($query) => $query->whereIn('status', [
                'collected', 'recycled', 'composted', 'returned_to_inventory', 'disposed_safely',
            ])->whereNotNull('collected_at')
            ->whereColumn('collected_at', '>', 'pickup_scheduled_for');

        $rows = (clone $base)
            ->when($scope === 'overdue', $overdue)
            ->when($scope === 'collected_late', $collectedLate)
            ->when($scope === 'all', fn ($query) => $query->where(fn ($query) => $query
                ->where($overdue)->orWhere($collectedLate)))
            ->with('centre:id,name,area,working_area', 'partner:id,name,phone')
            ->orderByDesc('pickup_scheduled_for')
            ->paginate(30)
            ->through(function ($pickup) {
                $end = $pickup->collected_at ?? now();

                return [
                    'id' => $pickup->id,
                    'centre' => $pickup->centre?->only(['id', 'name', 'area', 'working_area']),
                    'partner' => $pickup->partner?->only(['id', 'name', 'phone']),
                    'waste_type' => $pickup->waste_type,
                    'quantity' => (float) $pickup->quantity,
                    'unit' => $pickup->unit,
                    'status' => $pickup->status,
                    'delay_status' => $pickup->collected_at ? 'collected_late' : 'overdue',
                    'delay_minutes' => max(1, (int) ceil($pickup->pickup_scheduled_for->diffInSeconds($end) / 60)),
                    'pickup_scheduled_for' => $pickup->pickup_scheduled_for->toIso8601String(),
                    'collected_at' => $pickup->collected_at?->toIso8601String(),
                ];
            });

        return response()->json(['data' => [
            'overdue_count' => (clone $base)->where($overdue)->count(),
            'collected_late_count' => (clone $base)->where($collectedLate)->count(),
            'pickups' => $rows,
        ]]);
    }
}
