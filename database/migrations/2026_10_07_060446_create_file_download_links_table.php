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
        Schema::create('file_download_links', function (Blueprint $table) {
            $table->id();
            $table->uuid('token')->unique();
            $table->foreignId('file_record_id')->constrained('file_records')->cascadeOnDelete();
            $table->foreignId('client_application_id')->nullable()->constrained('client_applications')->nullOnDelete();
            $table->unsignedInteger('max_downloads')->nullable();
            $table->unsignedInteger('download_count')->default(0);
            $table->json('allowed_ips')->nullable();
            $table->string('password_hash')->nullable();
            $table->boolean('is_revoked')->default(false)->index();
            $table->timestamp('expires_at')->index();
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('file_download_links');
    }
};
