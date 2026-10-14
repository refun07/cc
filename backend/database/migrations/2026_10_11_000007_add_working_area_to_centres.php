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
            $table->string('working_area', 120)->nullable()->index();
        });

        DB::table('community_centres')->update(['working_area' => DB::raw('area')]);
        DB::table('community_centres')
            ->where('area', 'zone-1')
            ->where('name', 'like', '%Basabo%')
            ->update(['area' => 'Basabo']);
    }

    public function down(): void
    {
        Schema::table('community_centres', fn (Blueprint $table) => $table->dropColumn('working_area'));
    }
};
