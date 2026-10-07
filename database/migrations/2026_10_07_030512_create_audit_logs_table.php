<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_application_id')->nullable()->constrained('client_applications')->nullOnDelete();
            $table->foreignId('file_record_id')->nullable()->constrained('file_records')->nullOnDelete();
            $table->string('event')->index();
            $table->string('ip_address', 45);
            $table->text('user_agent')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('created_at')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
