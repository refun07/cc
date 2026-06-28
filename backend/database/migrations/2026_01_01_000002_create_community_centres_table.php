<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('community_centres', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('area');
            $table->text('address')->nullable();
            $table->text('description')->nullable();
            $table->integer('capacity')->default(0);
            $table->decimal('base_price', 12, 2)->default(0);
            $table->decimal('half_day_price', 12, 2)->default(0);
            $table->decimal('full_day_price', 12, 2)->default(0);
            $table->decimal('rating', 3, 2)->default(0);
            $table->enum('status', ['draft', 'pending', 'active', 'suspended'])->default('active');
            $table->string('virtual_tour_url')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->string('cover_image')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_centres');
    }
};
