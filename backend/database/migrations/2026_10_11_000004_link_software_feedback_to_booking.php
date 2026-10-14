<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('software_feedback', function (Blueprint $table) {
            $table->foreignId('booking_id')->nullable()->unique()
                ->constrained('bookings')->nullOnDelete();
            $table->text('comment')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('software_feedback')->whereNull('comment')->update(['comment' => '']);
        Schema::table('software_feedback', function (Blueprint $table) {
            $table->dropConstrainedForeignId('booking_id');
            $table->text('comment')->nullable(false)->change();
        });
    }
};
