<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            $table->string('decorator_phone', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('community_centres', fn (Blueprint $table) => $table->dropColumn('decorator_phone'));
    }
};
