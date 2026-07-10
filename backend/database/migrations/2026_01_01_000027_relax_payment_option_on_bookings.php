<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Drop the enum CHECK constraint on payment_option so newer options
     * (e.g. "later") can be stored. Kept as a plain string for flexibility.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('payment_option')->default('full')->change();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->enum('payment_option', ['full', 'advance'])->default('full')->change();
        });
    }
};
