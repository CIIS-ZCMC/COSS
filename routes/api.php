<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\FileDownloadController;
use App\Http\Controllers\Api\FileUploadController;
use Illuminate\Support\Facades\Route;

// Public signed route for temporary download (validated via signature query parameters)
Route::get('/v1/files/download/{uuid}', [FileDownloadController::class, 'download'])
    ->name('api.files.download');

Route::get('/v1/files/download/{uuid}/info', [FileDownloadController::class, 'linkInfo'])
    ->name('api.files.download_info');

// Authenticated Client API routes (Protected by auth.client zero-trust middleware)
Route::prefix('v1')->middleware('auth.client')->group(function () {
    // Direct multipart upload (< 50MB)
    Route::post('/files/upload', [FileUploadController::class, 'upload'])->name('api.files.upload');

    // Chunked & Resumable upload endpoints
    Route::post('/files/chunks/initiate', [FileUploadController::class, 'initiateChunked'])->name('api.files.chunks.initiate');
    Route::post('/files/chunks/{uploadId}', [FileUploadController::class, 'uploadChunkSlice'])->name('api.files.chunks.upload');
    Route::post('/files/chunks/{uploadId}/complete', [FileUploadController::class, 'completeChunked'])->name('api.files.chunks.complete');

    // File metadata & status polling
    Route::get('/files/{uuid}', [FileUploadController::class, 'show'])->name('api.files.show');

    // Temporary signed download URL generation
    Route::post('/files/{uuid}/signed-url', [FileDownloadController::class, 'createSignedUrl'])->name('api.files.signed_url');

    // Soft-delete with retention scheduling
    Route::delete('/files/{uuid}', [FileUploadController::class, 'destroy'])->name('api.files.destroy');

    // Audit logs
    Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('api.audit_logs.index');
});
