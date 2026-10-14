<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('photo')->nullable()->after('name');
            $table->string('nid')->nullable()->after('phone');
            $table->date('date_of_birth')->nullable()->after('nid');
            $table->string('address')->nullable()->after('date_of_birth');
            // Nominee
            $table->string('nominee_name')->nullable();
            $table->string('nominee_relation')->nullable();
            $table->string('nominee_phone')->nullable();
            $table->string('nominee_nid')->nullable();
            // Documents: array of { name, url }
            $table->json('documents')->nullable();
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->dateTime('check_in_at')->nullable()->after('status');
            $table->string('logged_by')->nullable()->after('check_in_at'); // self | owner | admin
        });

        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['photo', 'nid', 'date_of_birth', 'address', 'nominee_name', 'nominee_relation', 'nominee_phone', 'nominee_nid', 'documents']);
        });
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropColumn(['check_in_at', 'logged_by']);
        });
        Schema::dropIfExists('app_settings');
    }
};
