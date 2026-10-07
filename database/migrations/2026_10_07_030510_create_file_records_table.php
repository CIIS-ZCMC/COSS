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
        Schema::create('file_records', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('client_application_id')->constrained('client_applications')->cascadeOnDelete();
            $table->string('original_filename');
            $table->string('stored_filename');
            $table->string('mime_type');
            $table->unsignedBigInteger('size_bytes');
            $table->string('sha256_checksum')->index();
            $table->string('disk')->default('staging'); // staging, nas, quarantine
            $table->string('storage_path');
            $table->string('status')->default('pending_scan')->index(); // uploading, pending_scan, scanning, clean, infected, error
            $table->json('scan_result')->nullable();
            $table->unsignedInteger('retention_days')->default(90);
            $table->timestamp('purge_at')->nullable()->index();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('file_records');
    }
};
