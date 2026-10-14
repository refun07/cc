<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('waste_streams', function (Blueprint $table) {
            $table->foreignId('requested_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('collection_confirmed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('collection_notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('waste_streams', function (Blueprint $table) {
            foreach (['requested_by', 'assigned_by', 'collection_confirmed_by'] as $column) {
                $table->dropConstrainedForeignId($column);
            }
            $table->dropColumn('collection_notes');
        });
    }
};
