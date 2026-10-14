<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('completion_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completion_confirmed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('completion_confirmed_by');
            $table->dropColumn('completion_confirmed_at');
        });
    }
};
