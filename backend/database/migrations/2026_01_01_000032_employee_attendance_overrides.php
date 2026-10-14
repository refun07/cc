<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            // Per-employee payroll/attendance overrides. NULL = inherit the global rule.
            $table->decimal('absence_deduction_rate', 5, 2)->nullable()->after('hourly_rate');
            $table->decimal('leave_deduction_rate', 5, 2)->nullable()->after('absence_deduction_rate');
            $table->decimal('late_penalty', 10, 2)->nullable()->after('leave_deduction_rate');
            $table->string('late_after', 5)->nullable()->after('late_penalty'); // HH:MM cutoff for "late"
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['absence_deduction_rate', 'leave_deduction_rate', 'late_penalty', 'late_after']);
        });
    }
};
