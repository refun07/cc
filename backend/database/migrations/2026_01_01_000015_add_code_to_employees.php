<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('employee_code')->nullable()->unique()->after('id');
        });

        // Backfill existing rows.
        foreach (\App\Models\Employee::whereNull('employee_code')->get() as $e) {
            $e->update(['employee_code' => 'EMP-'.str_pad($e->id, 4, '0', STR_PAD_LEFT)]);
        }
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('employee_code');
        });
    }
};
