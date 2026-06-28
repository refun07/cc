<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('sku')->nullable();
            $table->string('unit')->default('pcs');
            $table->decimal('current_stock', 12, 2)->default(0);
            $table->decimal('minimum_stock', 12, 2)->default(0);
            $table->string('condition')->default('good');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('designation')->nullable();
            $table->decimal('salary', 12, 2)->default(0);
            $table->enum('status', ['active', 'inactive', 'on_leave'])->default('active');
            $table->date('joined_at')->nullable();
            $table->timestamps();
        });

        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('date');
            $table->enum('status', ['present', 'absent', 'leave', 'late'])->default('present');
            $table->timestamps();
            $table->unique(['employee_id', 'date']);
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->string('category')->nullable();
            $table->string('title');
            $table->decimal('amount', 12, 2)->default(0);
            $table->enum('status', ['paid', 'pending'])->default('pending');
            $table->date('expense_date')->nullable();
            $table->timestamps();
        });

        Schema::create('waste_streams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $table->string('waste_type');
            $table->decimal('quantity', 12, 2)->default(0);
            $table->string('unit')->default('kg');
            $table->enum('status', [
                'sorting_required', 'compost_pending', 'recycling_assigned', 'pickup_assigned',
                'collected', 'recycled', 'composted', 'returned_to_inventory', 'disposed_safely',
            ])->default('sorting_required');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waste_streams');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('inventory_items');
    }
};
