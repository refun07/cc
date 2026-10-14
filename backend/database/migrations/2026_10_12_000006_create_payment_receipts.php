<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->restrictOnDelete();
            $table->foreignId('booking_id')->constrained()->restrictOnDelete();
            $table->string('source_key')->unique();
            $table->string('source');
            $table->string('transaction_id')->nullable();
            $table->string('payment_method');
            $table->decimal('amount', 12, 2);
            $table->decimal('refunded_amount', 12, 2)->default(0);
            $table->decimal('vat_amount', 12, 2)->default(0);
            $table->decimal('commission', 12, 2)->default(0);
            $table->string('status')->default('paid');
            $table->timestamp('paid_at')->nullable()->index();
            $table->timestamps();
        });
        Schema::create('payment_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->restrictOnDelete();
            $table->string('request_key')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('reason', 500)->nullable();
            $table->timestamps();
            $table->unique(['booking_id', 'request_key']);
        });
        Schema::table('settlement_items', function (Blueprint $table) {
            $table->index('booking_id', 'settlement_items_booking_lookup');
        });
        Schema::table('settlement_items', function (Blueprint $table) {
            $table->dropUnique('settlement_items_booking_id_unique');
            $table->foreignId('payment_receipt_id')->nullable()->unique()->constrained('payment_receipts')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        // Receipt history must never be discarded by an accidental rollback.
        throw new RuntimeException('Financial history migration requires a reviewed restore, not rollback.');
    }
};
