<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InitiateChunkUploadRequest;
use App\Http\Requests\UploadChunkSliceRequest;
use App\Http\Requests\UploadFileRequest;
use App\Jobs\ScanUploadedFileJob;
use App\Models\ClientApplication;
use App\Models\FileChunk;
use App\Models\FileRecord;
use App\Services\AuditLoggerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class FileUploadController extends Controller
{
    public function __construct(
        protected AuditLoggerService $auditLogger
    ) {}

    /**
     * Direct multipart upload for files (< 50MB).
     */
    public function upload(UploadFileRequest $request): JsonResponse
    {
        /** @var ClientApplication $client */
        $client = $request->attributes->get('client_app');
        $uploadedFile = $request->file('file');

        $originalFilename = $uploadedFile->getClientOriginalName();
        $mimeType = $uploadedFile->getClientMimeType() ?: 'application/octet-stream';
        $sizeBytes = $uploadedFile->getSize();
        $storedFilename = (string) Str::uuid().'_'.preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $originalFilename);
        $storagePath = 'uploads/'.$client->uuid.'/'.$storedFilename;

        // Compute sha256 checksum
        $sha256 = hash_file('sha256', $uploadedFile->getRealPath());

        // Store directly into staging disk (restricted quarantine staging)
        $stagingDisk = Storage::disk('staging');
        $stagingDisk->putFileAs('uploads/'.$client->uuid, $uploadedFile, $storedFilename);

        $fileRecord = FileRecord::create([
            'client_application_id' => $client->id,
            'original_filename' => $originalFilename,
            'stored_filename' => $storedFilename,
            'mime_type' => $mimeType,
            'size_bytes' => $sizeBytes,
            'sha256_checksum' => $sha256,
            'disk' => 'staging',
            'storage_path' => $storagePath,
            'status' => 'pending_scan',
            'retention_days' => (int) ($request->input('retention_days') ?? 90),
        ]);

        $this->auditLogger->log('file.upload_received', $client, $fileRecord, [
            'original_filename' => $originalFilename,
            'size_bytes' => $sizeBytes,
            'sha256' => $sha256,
        ], $request);

        // Enqueue background security scan
        dispatch(new ScanUploadedFileJob($fileRecord));

        return response()->json([
            'message' => 'File uploaded successfully and submitted for security scanning.',
            'file' => [
                'uuid' => $fileRecord->uuid,
                'original_filename' => $fileRecord->original_filename,
                'size_bytes' => $fileRecord->size_bytes,
                'sha256' => $fileRecord->sha256_checksum,
                'status' => $fileRecord->status,
                'created_at' => $fileRecord->created_at->toIso8601String(),
            ],
        ], Response::HTTP_ACCEPTED);
    }

    /**
     * Initiate a chunked upload session for large files.
     */
    public function initiateChunked(InitiateChunkUploadRequest $request): JsonResponse
    {
        /** @var ClientApplication $client */
        $client = $request->attributes->get('client_app');
        $uploadId = (string) Str::uuid();

        // Create temporary directory for chunks on staging disk
        $tempPath = 'chunks/'.$client->uuid.'/'.$uploadId;
        Storage::disk('staging')->makeDirectory($tempPath);

        $this->auditLogger->log('chunk_upload.initiated', $client, null, [
            'upload_id' => $uploadId,
            'filename' => $request->input('filename'),
            'total_size_bytes' => $request->input('total_size_bytes'),
            'total_chunks' => $request->input('total_chunks'),
        ], $request);

        return response()->json([
            'upload_id' => $uploadId,
            'filename' => $request->input('filename'),
            'total_chunks' => (int) $request->input('total_chunks'),
            'total_size_bytes' => (int) $request->input('total_size_bytes'),
            'expires_at' => now()->addHours(24)->toIso8601String(),
        ], Response::HTTP_CREATED);
    }

    /**
     * Upload an individual chunk slice.
     */
    public function uploadChunkSlice(UploadChunkSliceRequest $request, string $uploadId): JsonResponse
    {
        /** @var ClientApplication $client */
        $client = $request->attributes->get('client_app');
        $chunkNumber = (int) $request->input('chunk_number');
        $chunkFile = $request->file('chunk');

        $sliceFilename = "chunk_{$chunkNumber}.part";
        $directory = 'chunks/'.$client->uuid.'/'.$uploadId;
        $relativePath = $directory.'/'.$sliceFilename;

        Storage::disk('staging')->putFileAs($directory, $chunkFile, $sliceFilename);

        FileChunk::updateOrCreate(
            [
                'upload_id' => $uploadId,
                'chunk_number' => $chunkNumber,
            ],
            [
                'client_application_id' => $client->id,
                'total_chunks' => 0, // updated on completion
                'chunk_size_bytes' => $chunkFile->getSize(),
                'temp_path' => $relativePath,
                'status' => 'received',
                'expires_at' => now()->addHours(24),
            ]
        );

        return response()->json([
            'upload_id' => $uploadId,
            'chunk_number' => $chunkNumber,
            'status' => 'received',
        ], Response::HTTP_OK);
    }

    /**
     * Complete chunked upload: reassemble slices, verify, and enqueue scan.
     */
    public function completeChunked(Request $request, string $uploadId): JsonResponse
    {
        /** @var ClientApplication $client */
        $client = $request->attributes->get('client_app');

        $validated = $request->validate([
            'filename' => ['required', 'string', 'max:255'],
            'total_chunks' => ['required', 'integer', 'min:1'],
            'mime_type' => ['nullable', 'string'],
            'retention_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $totalChunks = (int) $validated['total_chunks'];
        $receivedChunks = FileChunk::where('upload_id', $uploadId)
            ->where('client_application_id', $client->id)
            ->pluck('chunk_number')
            ->toArray();

        for ($i = 1; $i <= $totalChunks; $i++) {
            if (! in_array($i, $receivedChunks, true)) {
                return response()->json([
                    'error' => 'MissingChunks',
                    'message' => "Chunk {$i} is missing. All {$totalChunks} chunks must be uploaded before completion.",
                ], Response::HTTP_BAD_REQUEST);
            }
        }

        $stagingDisk = Storage::disk('staging');
        $storedFilename = (string) Str::uuid().'_'.preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $validated['filename']);
        $finalStoragePath = 'uploads/'.$client->uuid.'/'.$storedFilename;
        $finalAbsolutePath = $stagingDisk->path($finalStoragePath);

        // Ensure target directory exists
        $stagingDisk->makeDirectory('uploads/'.$client->uuid);

        $outHandle = fopen($finalAbsolutePath, 'wb');
        if ($outHandle === false) {
            return response()->json(['error' => 'Failed to initialize output stream on staging disk'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        for ($i = 1; $i <= $totalChunks; $i++) {
            $slicePath = $stagingDisk->path("chunks/{$client->uuid}/{$uploadId}/chunk_{$i}.part");
            $inHandle = fopen($slicePath, 'rb');
            if ($inHandle) {
                stream_copy_to_stream($inHandle, $outHandle);
                fclose($inHandle);
            }
        }
        fclose($outHandle);

        // Clean up temporary chunks directory
        $stagingDisk->deleteDirectory("chunks/{$client->uuid}/{$uploadId}");
        FileChunk::where('upload_id', $uploadId)->delete();

        $sizeBytes = filesize($finalAbsolutePath);
        $sha256 = hash_file('sha256', $finalAbsolutePath);

        $fileRecord = FileRecord::create([
            'client_application_id' => $client->id,
            'original_filename' => $validated['filename'],
            'stored_filename' => $storedFilename,
            'mime_type' => $validated['mime_type'] ?? 'application/octet-stream',
            'size_bytes' => $sizeBytes,
            'sha256_checksum' => $sha256,
            'disk' => 'staging',
            'storage_path' => $finalStoragePath,
            'status' => 'pending_scan',
            'retention_days' => (int) ($validated['retention_days'] ?? 90),
        ]);

        $this->auditLogger->log('file.chunk_assembled', $client, $fileRecord, [
            'upload_id' => $uploadId,
            'total_chunks' => $totalChunks,
            'size_bytes' => $sizeBytes,
            'sha256' => $sha256,
        ], $request);

        // Enqueue background security scan
        dispatch(new ScanUploadedFileJob($fileRecord));

        return response()->json([
            'message' => 'Chunked upload assembled successfully and queued for security scanning.',
            'file' => [
                'uuid' => $fileRecord->uuid,
                'original_filename' => $fileRecord->original_filename,
                'size_bytes' => $fileRecord->size_bytes,
                'sha256' => $fileRecord->sha256_checksum,
                'status' => $fileRecord->status,
                'created_at' => $fileRecord->created_at->toIso8601String(),
            ],
        ], Response::HTTP_ACCEPTED);
    }

    /**
     * Retrieve file status & metadata.
     */
    public function show(Request $request, string $uuid): JsonResponse
    {
        /** @var ClientApplication $client */
        $client = $request->attributes->get('client_app');

        $file = FileRecord::where('uuid', $uuid)
            ->where('client_application_id', $client->id)
            ->firstOrFail();

        return response()->json([
            'file' => [
                'uuid' => $file->uuid,
                'original_filename' => $file->original_filename,
                'mime_type' => $file->mime_type,
                'size_bytes' => $file->size_bytes,
                'sha256' => $file->sha256_checksum,
                'status' => $file->status,
                'scan_result' => $file->scan_result,
                'retention_days' => $file->retention_days,
                'purge_at' => $file->purge_at?->toIso8601String(),
                'created_at' => $file->created_at->toIso8601String(),
                'updated_at' => $file->updated_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * Soft delete file with retention period.
     */
    public function destroy(Request $request, string $uuid): JsonResponse
    {
        /** @var ClientApplication $client */
        $client = $request->attributes->get('client_app');

        $file = FileRecord::where('uuid', $uuid)
            ->where('client_application_id', $client->id)
            ->firstOrFail();

        $purgeDate = now()->addDays($file->retention_days);
        $file->update(['purge_at' => $purgeDate]);
        $file->delete(); // Soft delete

        $this->auditLogger->log('file.soft_deleted', $client, $file, [
            'purge_at' => $purgeDate->toIso8601String(),
        ], $request);

        return response()->json([
            'message' => 'File soft-deleted and scheduled for retention purge.',
            'uuid' => $file->uuid,
            'purge_at' => $purgeDate->toIso8601String(),
        ]);
    }
}
