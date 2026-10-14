<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->renameColumn('completion_confirmed_by', 'completion_verified_by');
            $table->renameColumn('completion_confirmed_at', 'completion_verified_at');
        });

        $this->replacePermission('bookings.complete', 'bookings.verify');
    }

    public function down(): void
    {
        $this->replacePermission('bookings.verify', 'bookings.complete');

        Schema::table('bookings', function (Blueprint $table) {
            $table->renameColumn('completion_verified_by', 'completion_confirmed_by');
            $table->renameColumn('completion_verified_at', 'completion_confirmed_at');
        });
    }

    private function replacePermission(string $old, string $new): void
    {
        DB::table('users')->where('role', 'project_coordinator')
            ->whereNotNull('coordinator_permissions')
            ->get(['id', 'coordinator_permissions'])
            ->each(function ($user) use ($old, $new) {
                $permissions = json_decode($user->coordinator_permissions, true);
                if (! is_array($permissions) || ! in_array($old, $permissions, true)) {
                    return;
                }

                $updated = array_values(array_unique(array_map(
                    fn ($permission) => $permission === $old ? $new : $permission,
                    $permissions
                )));
                DB::table('users')->where('id', $user->id)
                    ->update(['coordinator_permissions' => json_encode($updated)]);
            });
    }
};
