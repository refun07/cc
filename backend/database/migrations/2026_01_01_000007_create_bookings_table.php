<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_no')->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->string('customer_name');
            $table->string('customer_phone');
            $table->string('customer_email')->nullable();
            $table->date('event_date');
            $table->enum('session_type', ['full_day', 'half_day_morning', 'half_day_evening']);
            $table->integer('guest_count')->default(0);
            $table->string('event_type')->nullable();
            $table->decimal('venue_amount', 12, 2)->default(0);
            $table->decimal('food_amount', 12, 2)->default(0);
            $table->decimal('service_charge', 12, 2)->default(0);
            $table->decimal('vat_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('status', [
                'draft', 'pending_review', 'payment_pending', 'paid',
                'confirmed', 'cancelled', 'completed', 'refunded',
            ])->default('pending_review');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
