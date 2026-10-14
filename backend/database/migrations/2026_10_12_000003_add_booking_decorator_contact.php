<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedBigInteger('centre_decorator_id')->nullable();
            $table->string('decorator_name')->nullable();
            $table->string('decorator_phone', 30)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['centre_decorator_id', 'decorator_name', 'decorator_phone']);
        });
    }
};
