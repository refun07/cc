<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('centre_floors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->string('name');                      // e.g. "Ground Floor", "2nd Floor Hall"
            $table->string('description')->nullable();
            $table->integer('capacity')->default(0);
            $table->decimal('half_day_price', 12, 2)->default(0);
            $table->decimal('full_day_price', 12, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
            $table->index(['centre_id', 'status']);
        });

        // A floor books independently: the same date+session can be sold once per floor.
        Schema::table('availability_slots', function (Blueprint $table) {
            $table->foreignId('centre_floor_id')->nullable()->after('centre_id')
                ->constrained('centre_floors')->cascadeOnDelete();
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('centre_floor_id')->nullable()->after('centre_id')
                ->constrained('centre_floors')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', fn (Blueprint $t) => $t->dropConstrainedForeignId('centre_floor_id'));
        Schema::table('availability_slots', fn (Blueprint $t) => $t->dropConstrainedForeignId('centre_floor_id'));
        Schema::dropIfExists('centre_floors');
    }
};
