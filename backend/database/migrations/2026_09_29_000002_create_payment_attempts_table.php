<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payment_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('transaction_id', 64)->unique();
            $table->decimal('amount', 12, 2);
            $table->string('status', 20)->default('initiating');
            $table->text('secure_token')->nullable();
            $table->timestamp('initiated_at');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->string('gateway_transaction_id', 100)->nullable();
            $table->timestamps();
            $table->index(['booking_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_attempts');
    }
};
