<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payrolls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('month'); // YYYY-MM
            $table->decimal('basic_salary', 12, 2)->default(0);
            $table->decimal('bonus', 12, 2)->default(0);
            $table->decimal('deduction', 12, 2)->default(0);
            $table->decimal('net_salary', 12, 2)->default(0);
            $table->integer('present_days')->default(0);
            $table->integer('absent_days')->default(0);
            $table->enum('status', ['pending', 'paid'])->default('pending');
            $table->string('payment_method')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'month']);
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->string('vendor')->nullable()->after('category');
            $table->string('payment_method')->nullable()->after('amount');
            $table->string('reference_no')->nullable()->after('payment_method');
            $table->date('due_date')->nullable()->after('expense_date');
            $table->text('notes')->nullable()->after('due_date');
            $table->string('bill_image')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payrolls');
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn(['vendor', 'payment_method', 'reference_no', 'due_date', 'notes']);
        });
    }
};
