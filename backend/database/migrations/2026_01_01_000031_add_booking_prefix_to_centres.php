<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            $table->string('booking_prefix', 12)->default('DSCC')->after('slug');
        });
    }

    public function down(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            $table->dropColumn('booking_prefix');
        });
    }
};
