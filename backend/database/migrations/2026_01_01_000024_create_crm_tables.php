<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('crm_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('centre_id')->constrained('community_centres')->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('phone', 30);
            $table->string('email')->nullable();
            $table->enum('stage', ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'customer'])->default('new');
            $table->string('source')->default('manual');
            $table->json('tags')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('last_contacted_at')->nullable();
            $table->timestamp('next_follow_up_at')->nullable();
            $table->timestamps();
            $table->unique(['centre_id', 'phone']);
            $table->index(['centre_id', 'stage']);
            $table->index('next_follow_up_at');
        });

        Schema::create('crm_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_id')->constrained('crm_contacts')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('type', ['call', 'whatsapp', 'email', 'meeting', 'note', 'follow_up']);
            $table->string('subject')->nullable();
            $table->text('details')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamp('next_follow_up_at')->nullable();
            $table->timestamps();
        });

        $now = now();
        DB::table('bookings')->orderBy('id')->get()->groupBy(fn ($booking) => $booking->centre_id.'|'.$booking->customer_phone)
            ->each(function ($bookings) use ($now) {
                $latest = $bookings->sortByDesc('created_at')->first();
                DB::table('crm_contacts')->insert([
                    'centre_id' => $latest->centre_id,
                    'name' => $latest->customer_name,
                    'phone' => $latest->customer_phone,
                    'email' => $latest->customer_email,
                    'stage' => 'customer',
                    'source' => 'booking',
                    'notes' => 'Imported from existing booking history.',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_activities');
        Schema::dropIfExists('crm_contacts');
    }
};
