<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('identity_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->text('name');
            $table->text('date_of_birth');
            $table->text('nid_number');
            $table->string('image_path');
            $table->string('image_mime', 32);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        // Retained identity evidence must not be removed by a routine rollback.
    }
};
