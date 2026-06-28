<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_dates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->date('date');
            $table->enum('session_type', ['full_day', 'half_day_morning', 'half_day_evening']);
            $table->timestamps();
            $table->unique(['booking_id', 'date', 'session_type']);
            $table->index(['date', 'session_type']);
        });

        $now = now();
        DB::table('bookings')->orderBy('id')->get(['id', 'event_date', 'session_type'])->each(function ($booking) use ($now) {
            DB::table('booking_dates')->insert([
                'booking_id' => $booking->id,
                'date' => $booking->event_date,
                'session_type' => $booking->session_type,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_dates');
    }
};
