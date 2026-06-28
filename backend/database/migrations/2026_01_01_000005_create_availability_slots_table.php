<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('availability_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->date('date');
            $table->enum('session_type', ['full_day', 'half_day_morning', 'half_day_evening']);
            $table->enum('status', ['available', 'blocked', 'booked'])->default('available');
            $table->timestamps();
            $table->unique(['centre_id', 'date', 'session_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('availability_slots');
    }
};
