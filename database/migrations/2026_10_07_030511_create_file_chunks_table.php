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
        Schema::create('file_chunks', function (Blueprint $table) {
            $table->id();
            $table->uuid('upload_id')->index();
            $table->foreignId('client_application_id')->constrained('client_applications')->cascadeOnDelete();
            $table->unsignedInteger('chunk_number');
            $table->unsignedInteger('total_chunks');
            $table->unsignedBigInteger('chunk_size_bytes');
            $table->string('temp_path');
            $table->string('status')->default('received'); // received, assembled
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->unique(['upload_id', 'chunk_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('file_chunks');
    }
};
