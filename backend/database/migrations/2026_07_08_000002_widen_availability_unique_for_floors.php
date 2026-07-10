<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A slot is unique per floor, not per centre: two floors of the same venue
     * can each hold the same date + session independently.
     */
    public function up(): void
    {
        Schema::table('availability_slots', function (Blueprint $table) {
            $table->dropUnique('availability_slots_centre_id_date_session_type_unique');
            $table->unique(['centre_id', 'centre_floor_id', 'date', 'session_type'], 'availability_slots_centre_floor_date_session_unique');
        });
    }

    public function down(): void
    {
        Schema::table('availability_slots', function (Blueprint $table) {
            $table->dropUnique('availability_slots_centre_floor_date_session_unique');
            $table->unique(['centre_id', 'date', 'session_type'], 'availability_slots_centre_id_date_session_type_unique');
        });
    }
};
