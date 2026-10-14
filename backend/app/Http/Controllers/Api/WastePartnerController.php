<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WasteStream;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WastePartnerController extends Controller
{
    private const FINAL_STATUSES = [
        'recycled',
        'composted',
        'returned_to_inventory',
        'disposed_safely',
    ];

    public function dashboard(Request $request)
    {
        $partnerId = $request->user()->id;
        $assigned = WasteStream::where('assigned_partner_id', $partnerId);
        $processed = (clone $assigned)->whereIn('status', self::FINAL_STATUSES);

        return response()->json([
            'stats' => [
                'available_pickups' => WasteStream::where('status', 'pickup_assigned')
                    ->whereNull('assigned_partner_id')->count(),
                'active_pickups' => (clone $assigned)
                    ->whereIn('status', ['pickup_assigned', 'collected'])->count(),
                'completed_pickups' => (clone $processed)->count(),
                'total_diverted' => (float) (clone $processed)->where('unit', 'kg')->sum('quantity'),
                'items_recovered' => (float) (clone $processed)->where('unit', 'pcs')->sum('quantity'),
                'centres_served' => (clone $processed)->distinct('centre_id')->count('centre_id'),
            ],
            'upcoming' => $this->serialize(
                (clone $assigned)
                    ->where('status', 'pickup_assigned')
                    ->with('centre:id,name,area,address')
                    ->orderByRaw('pickup_scheduled_for is null, pickup_scheduled_for')
                    ->limit(6)
                    ->get()
            ),
            'recent' => $this->serialize(
                (clone $assigned)
                    ->whereIn('status', array_merge(['collected'], self::FINAL_STATUSES))
                    ->with('centre:id,name,area,address')
                    ->latest('updated_at')
                    ->limit(6)
                    ->get()
            ),
        ]);
    }

    public function pickups(Request $request)
    {
        $scope = $request->query('scope', 'active');
        $partnerId = $request->user()->id;

        $query = WasteStream::with('centre:id,name,area,address');
        if ($scope === 'available') {
            $query->where('status', 'pickup_assigned')->whereNull('assigned_partner_id');
        } elseif ($scope === 'completed') {
            $query->where('assigned_partner_id', $partnerId)->whereIn('status', self::FINAL_STATUSES);
        } elseif ($scope === 'all') {
            $query->where(function ($q) use ($partnerId) {
                $q->where('assigned_partner_id', $partnerId)
                    ->orWhere(function ($available) {
                        $available->where('status', 'pickup_assigned')->whereNull('assigned_partner_id');
                    });
            });
        } else {
            $query->where('assigned_partner_id', $partnerId)
                ->whereIn('status', ['pickup_assigned', 'collected']);
        }

        return response()->json(['data' => $this->serialize($query->latest()->limit(100)->get())]);
    }

    public function claim(Request $request, WasteStream $waste)
    {
        $data = $request->validate([
            'pickup_scheduled_for' => ['required', 'date', 'after_or_equal:now'],
            'partner_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $waste = DB::transaction(function () use ($request, $waste, $data) {
            $locked = WasteStream::lockForUpdate()->findOrFail($waste->id);

            if ($locked->status !== 'pickup_assigned' || $locked->assigned_partner_id) {
                throw ValidationException::withMessages([
                    'pickup' => 'This pickup is no longer available.',
                ]);
            }

            $locked->update([
                'assigned_partner_id' => $request->user()->id,
                'pickup_scheduled_for' => $data['pickup_scheduled_for'],
                'partner_notes' => $data['partner_notes'] ?? null,
            ]);

            return $locked;
        });

        return response()->json(['data' => $this->one($waste->load('centre:id,name,area,address'))]);
    }

    public function updateStatus(Request $request, WasteStream $waste)
    {
        abort_unless($waste->assigned_partner_id === $request->user()->id, 403, 'This pickup is assigned to another partner.');
        abort_if($waste->requested_by && ! $waste->collection_confirmed_by, 422, 'The centre caretaker must confirm collection first.');

        $data = $request->validate([
            'status' => ['required', 'in:collected,recycled,composted,returned_to_inventory,disposed_safely'],
            'partner_notes' => ['nullable', 'string', 'max:1000'],
            'proof_image' => ['nullable', 'string', 'max:500'],
        ]);

        $allowed = $waste->status === 'pickup_assigned'
            ? ['collected']
            : ($waste->status === 'collected' ? self::FINAL_STATUSES : []);

        if (! in_array($data['status'], $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => 'Complete the pickup stages in order: collected, then processed.',
            ]);
        }

        $updates = [
            'status' => $data['status'],
            'partner_notes' => $data['partner_notes'] ?? $waste->partner_notes,
        ];
        if (! empty($data['proof_image'])) {
            $updates['proof_image'] = $data['proof_image'];
        }
        if ($data['status'] === 'collected') {
            $updates['collected_at'] = now();
        } else {
            $updates['processed_at'] = now();
        }
        $waste->update($updates);

        // Keep the centre owner informed.
        $ownerId = $waste->centre?->owner_id;
        $label = $data['status'] === 'collected' ? 'Waste collected' : 'Waste processed';
        \App\Services\Notify::send($ownerId, $label,
            "{$waste->waste_type} from your centre is now {$data['status']}.", 'waste', '/owner/waste');

        return response()->json(['data' => $this->one($waste->load('centre:id,name,area,address'))]);
    }

    /** Upload a collection proof image; returns a public URL. */
    public function upload(Request $request)
    {
        $request->validate(['file' => ['required', 'image', 'max:5120']]);
        $path = $request->file('file')->store('waste-proof', 'public');

        return response()->json(['url' => \Illuminate\Support\Facades\Storage::url($path)]);
    }

    private function serialize($rows): array
    {
        return $rows->map(fn (WasteStream $waste) => $this->one($waste))->values()->all();
    }

    private function one(WasteStream $waste): array
    {
        return [
            'id' => $waste->id,
            'awaiting_caretaker_confirmation' => (bool) ($waste->requested_by && ! $waste->collection_confirmed_by),
            'centre' => $waste->centre,
            'waste_type' => $waste->waste_type,
            'quantity' => (float) $waste->quantity,
            'unit' => $waste->unit,
            'status' => $waste->status,
            'notes' => $waste->notes,
            'partner_notes' => $waste->partner_notes,
            'proof_image' => $waste->proof_image,
            'pickup_scheduled_for' => $waste->pickup_scheduled_for?->toIso8601String(),
            'collected_at' => $waste->collected_at?->toIso8601String(),
            'processed_at' => $waste->processed_at?->toIso8601String(),
            'created_at' => $waste->created_at?->toIso8601String(),
        ];
    }
}
