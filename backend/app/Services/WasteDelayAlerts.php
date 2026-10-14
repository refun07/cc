<?php

namespace App\Services;

use App\Models\User;
use App\Models\WasteStream;
use Illuminate\Support\Facades\DB;

class WasteDelayAlerts
{
    public function sendNewAlerts(): int
    {
        $sent = 0;
        WasteStream::query()
            ->where('status', 'pickup_assigned')
            ->whereNotNull('assigned_partner_id')
            ->whereNotNull('pickup_scheduled_for')
            ->where('pickup_scheduled_for', '<', now())
            ->whereNull('pickup_delay_alerted_at')
            ->with('centre:id,name,working_area', 'partner:id,name')
            ->chunkById(100, function ($pickups) use (&$sent) {
                foreach ($pickups as $pickup) {
                    DB::transaction(function () use ($pickup, &$sent) {
                        $claimed = WasteStream::whereKey($pickup->id)
                            ->where('status', 'pickup_assigned')
                            ->where('pickup_scheduled_for', $pickup->pickup_scheduled_for)
                            ->whereNull('pickup_delay_alerted_at')
                            ->update(['pickup_delay_alerted_at' => now()]);
                        if (! $claimed) {
                            return;
                        }

                        $body = "Pickup #{$pickup->id} for {$pickup->centre?->name} was due "
                            .$pickup->pickup_scheduled_for->timezone('Asia/Dhaka')->format('d M Y, h:i A')
                            ." and has not been collected by {$pickup->partner?->name}.";
                        User::where('status', 'active')
                            ->where(fn ($query) => $query->where('role', 'admin')
                                ->when($pickup->centre?->working_area, fn ($query, $area) => $query->orWhere(
                                    fn ($scoped) => $scoped->where('role', 'area_admin')->where('area_scope', $area))))
                            ->get(['id', 'role'])
                            ->each(fn ($recipient) => Notify::send($recipient->id, 'Waste pickup overdue', $body, 'waste',
                                $recipient->role === 'admin' ? '/admin/waste-delays' : '/area/waste-delays'));
                        $sent++;
                    });
                }
            });

        return $sent;
    }
}
