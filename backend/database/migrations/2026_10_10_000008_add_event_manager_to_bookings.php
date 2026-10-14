<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('event_manager_name')->nullable();
            $table->string('event_manager_phone', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', fn (Blueprint $table) => $table->dropColumn(['event_manager_name', 'event_manager_phone']));
    }
};
