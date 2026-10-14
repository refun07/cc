<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            $table->string('decorator_name')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            $table->dropColumn('decorator_name');
        });
    }
};
