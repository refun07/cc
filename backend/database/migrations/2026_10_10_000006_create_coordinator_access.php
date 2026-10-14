<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('coordinator_permissions')->nullable();
        });

        Schema::create('coordinator_centre', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('community_centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->primary(['user_id', 'community_centre_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coordinator_centre');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('coordinator_permissions'));
    }
};
