<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('centre_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment');
            $table->timestamps();
            $table->unique(['centre_id', 'user_id']);
        });

        Schema::create('software_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('software_feedback');
        Schema::dropIfExists('centre_reviews');
    }
};
