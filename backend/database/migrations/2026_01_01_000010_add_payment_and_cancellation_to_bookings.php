<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->enum('payment_option', ['full', 'advance'])->default('full')->after('total_amount');
            $table->decimal('advance_amount', 12, 2)->default(0)->after('payment_option');
            $table->decimal('paid_amount', 12, 2)->default(0)->after('advance_amount');
            $table->decimal('due_amount', 12, 2)->default(0)->after('paid_amount');
            $table->decimal('refunded_amount', 12, 2)->default(0)->after('due_amount');
            $table->timestamp('cancelled_at')->nullable()->after('status');
            $table->text('cancellation_reason')->nullable()->after('cancelled_at');
        });

        // Partial vs full refund is tracked via payments.refunded_amount; status stays 'refunded'.
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('refunded_amount', 12, 2)->default(0)->after('amount');
            $table->timestamp('refunded_at')->nullable()->after('paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn([
                'payment_option', 'advance_amount', 'paid_amount', 'due_amount',
                'refunded_amount', 'cancelled_at', 'cancellation_reason',
            ]);
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['refunded_amount', 'refunded_at']);
        });
    }
};
