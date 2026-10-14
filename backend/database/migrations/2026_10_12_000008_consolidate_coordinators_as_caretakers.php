<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Keep account IDs, credentials, permissions, assignments and all audit references.
        DB::transaction(function () {
            foreach (DB::table('users')->where('role', 'project_coordinator')->get(['id']) as $user) {
                $centreId = DB::table('coordinator_centre')->where('user_id', $user->id)->orderBy('community_centre_id')->value('community_centre_id');
                DB::table('users')->where('id', $user->id)->update(['role' => 'caretaker', 'caretaker_centre_id' => $centreId]);
            }
        });
    }

    public function down(): void
    {
        // Role consolidation is intentionally not reversed: new caretaker assignments may exist.
    }
};
