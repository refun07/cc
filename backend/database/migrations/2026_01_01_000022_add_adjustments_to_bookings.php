<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('adjustment_amount', 12, 2)->default(0)->after('vat_amount');
            $table->string('adjustment_reason')->nullable()->after('adjustment_amount');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['adjustment_amount', 'adjustment_reason']);
        });
    }
};
