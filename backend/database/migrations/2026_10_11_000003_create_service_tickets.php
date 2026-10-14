<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('assigned_to')->constrained('users')->restrictOnDelete();
            $table->string('subject', 150);
            $table->text('description');
            $table->string('status', 20)->default('open');
            $table->timestamp('first_responded_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['assigned_to', 'status']);
            $table->index(['centre_id', 'created_at']);
        });

        Schema::create('service_ticket_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 20);
            $table->text('message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['service_ticket_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_ticket_actions');
        Schema::dropIfExists('service_tickets');
    }
};
