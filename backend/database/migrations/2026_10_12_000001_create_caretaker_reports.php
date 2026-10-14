<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('caretaker_centre_id')->nullable()->constrained('community_centres')->nullOnDelete();
        });

        Schema::create('booking_completion_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('centre_id')->constrained('community_centres')->restrictOnDelete();
            $table->foreignId('caretaker_id')->constrained('users')->restrictOnDelete();
            $table->string('outcome', 24);
            $table->text('notes')->nullable();
            $table->timestamp('reported_at');
            $table->timestamps();
            $table->index(['centre_id', 'reported_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_completion_reports');
        Schema::table('users', fn (Blueprint $table) => $table->dropConstrainedForeignId('caretaker_centre_id'));
    }
};
