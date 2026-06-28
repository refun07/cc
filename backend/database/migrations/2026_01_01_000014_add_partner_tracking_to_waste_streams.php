<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('waste_streams', function (Blueprint $table) {
            $table->foreignId('assigned_partner_id')
                ->nullable()
                ->after('booking_id')
                ->constrained('users')
                ->nullOnDelete();
            $table->dateTime('pickup_scheduled_for')->nullable()->after('status');
            $table->dateTime('collected_at')->nullable()->after('pickup_scheduled_for');
            $table->dateTime('processed_at')->nullable()->after('collected_at');
            $table->text('partner_notes')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('waste_streams', function (Blueprint $table) {
            $table->dropForeign(['assigned_partner_id']);
            $table->dropColumn([
                'assigned_partner_id',
                'pickup_scheduled_for',
                'collected_at',
                'processed_at',
                'partner_notes',
            ]);
        });
    }
};
