<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->decimal('standard_hours', 5, 2)->nullable()->after('late_after'); // NULL = inherit centre/global
            $table->string('weekly_off', 20)->nullable()->after('standard_hours');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['standard_hours', 'weekly_off']);
        });
    }
};
