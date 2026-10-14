<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('employment_type')->default('monthly')->after('designation'); // monthly | hourly
            $table->decimal('hourly_rate', 10, 2)->default(0)->after('salary');
        });
        Schema::table('payrolls', function (Blueprint $table) {
            $table->decimal('hours_worked', 8, 2)->default(0)->after('absent_days');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['employment_type', 'hourly_rate']);
        });
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropColumn('hours_worked');
        });
    }
};
