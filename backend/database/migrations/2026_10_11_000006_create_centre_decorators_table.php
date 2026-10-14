<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('centre_decorators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->string('name');
            $table->string('phone', 20);
            $table->string('service_area');
            $table->string('address')->nullable();
            $table->text('description')->nullable();
            $table->string('status', 10)->default('active');
            $table->timestamps();
            $table->index(['centre_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('centre_decorators');
    }
};
