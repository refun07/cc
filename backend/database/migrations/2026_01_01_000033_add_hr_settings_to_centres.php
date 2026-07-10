<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            // Per-centre HR defaults. NULL = inherit the global admin rule.
            $table->string('hr_late_cutoff', 5)->nullable();
            $table->decimal('hr_absence_deduction_rate', 5, 2)->nullable();
            $table->decimal('hr_leave_deduction_rate', 5, 2)->nullable();
            $table->decimal('hr_late_penalty', 10, 2)->nullable();
            $table->decimal('hr_standard_hours', 5, 2)->default(8);
            $table->string('hr_weekly_off', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            $table->dropColumn(['hr_late_cutoff', 'hr_absence_deduction_rate', 'hr_leave_deduction_rate', 'hr_late_penalty', 'hr_standard_hours', 'hr_weekly_off']);
        });
    }
};
