<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            $table->string('centre_type')->default('community_centre');
        });

        DB::table('community_centres')->where('name', 'like', '%convention%')
            ->update(['centre_type' => 'convention_centre']);
        DB::table('community_centres')->where('name', 'like', '%banquet%')
            ->update(['centre_type' => 'banquet_hall']);
    }

    public function down(): void
    {
        Schema::table('community_centres', function (Blueprint $table) {
            $table->dropColumn('centre_type');
        });
    }
};
