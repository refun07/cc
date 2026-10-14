<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('waste_streams', function (Blueprint $table) {
            $table->timestamp('pickup_delay_alerted_at')->nullable();
            $table->index(['status', 'pickup_scheduled_for']);
        });
    }

    public function down(): void
    {
        Schema::table('waste_streams', function (Blueprint $table) {
            $table->dropIndex(['status', 'pickup_scheduled_for']);
            $table->dropColumn('pickup_delay_alerted_at');
        });
    }
};
