<?php

namespace Tests\Feature;

use App\Jobs\ScanUploadedFileJob;
use App\Models\ClientApplication;
use App\Models\FileRecord;
use App\Services\AuditLoggerService;
use App\Services\Scanner\MockScanner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class FileManagementTest extends TestCase
{
    use RefreshDatabase;

    protected ClientApplication $client;

    protected string $plainSecret = 'super-secret-key-123';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('staging');
        Storage::fake('nas');
        Storage::fake('quarantine');

        $this->client = ClientApplication::create([
            'name' => 'Internal Hospital EHR Client',
            'api_key' => 'ehr-api-key-test',
            'api_secret_hash' => Hash::make($this->plainSecret),
            'is_active' => true,
        ]);
    }

    /**
     * Helper to add auth headers.
     *
     * @return array<string, string>
     */
    protected function authHeaders(): array
    {
        return [
            'X-API-Key' => $this->client->api_key,
            'X-API-Secret' => $this->plainSecret,
        ];
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->postJson('/api/v1/files/upload', []);

        $response->assertStatus(401)
            ->assertJsonPath('error', 'Unauthorized');
    }

    public function test_multipart_file_upload_enqueues_scan_and_records_audit(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->create('medical_record.pdf', 1024, 'application/pdf');

        $response = $this->withHeaders($this->authHeaders())
            ->postJson('/api/v1/files/upload', [
                'file' => $file,
            ]);

        $response->assertStatus(202)
            ->assertJsonPath('file.original_filename', 'medical_record.pdf')
            ->assertJsonPath('file.status', 'pending_scan');

        $fileUuid = $response->json('file.uuid');

        $record = FileRecord::where('uuid', $fileUuid)->firstOrFail();
        $this->assertStringStartsWith('uploads/internal-hospital-ehr-client/', $record->storage_path);

        $this->assertDatabaseHas('file_records', [
            'uuid' => $fileUuid,
            'client_application_id' => $this->client->id,
            'original_filename' => 'medical_record.pdf',
            'status' => 'pending_scan',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'client_application_id' => $this->client->id,
            'event' => 'file.upload_received',
        ]);

        Queue::assertPushed(ScanUploadedFileJob::class);
    }

    public function test_scan_job_promotes_clean_file_to_nas(): void
    {
        $filename = 'test_clean_doc.txt';
        $content = 'Sample confidential file contents.';
        $storagePath = 'uploads/'.$this->client->uuid.'/test_clean_doc.txt';

        Storage::disk('staging')->put($storagePath, $content);

        $fileRecord = FileRecord::create([
            'client_application_id' => $this->client->id,
            'original_filename' => $filename,
            'stored_filename' => $filename,
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($content),
            'sha256_checksum' => hash('sha256', $content),
            'disk' => 'staging',
            'storage_path' => $storagePath,
            'status' => 'pending_scan',
        ]);

        $scanner = new MockScanner;
        $auditLogger = app(AuditLoggerService::class);

        $job = new ScanUploadedFileJob($fileRecord);
        $job->handle($scanner, $auditLogger);

        $fileRecord->refresh();

        $this->assertEquals('clean', $fileRecord->status);
        $this->assertEquals('nas', $fileRecord->disk);
        $this->assertTrue(Storage::disk('nas')->exists($storagePath));
        $this->assertFalse(Storage::disk('staging')->exists($storagePath));

        $this->assertDatabaseHas('audit_logs', [
            'file_record_id' => $fileRecord->id,
            'event' => 'file.scan_clean',
        ]);
    }

    public function test_scan_job_isolates_infected_file_in_quarantine(): void
    {
        $filename = 'infected_sample.txt';
        $content = '__INFECTED_PAYLOAD_TEST__'; // Simulated threat payload for mock scanner
        $storagePath = 'uploads/'.$this->client->uuid.'/infected_sample.txt';

        Storage::disk('staging')->put($storagePath, $content);

        $fileRecord = FileRecord::create([
            'client_application_id' => $this->client->id,
            'original_filename' => $filename,
            'stored_filename' => $filename,
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($content),
            'sha256_checksum' => hash('sha256', $content),
            'disk' => 'staging',
            'storage_path' => $storagePath,
            'status' => 'pending_scan',
        ]);

        $scanner = new MockScanner;
        $auditLogger = app(AuditLoggerService::class);

        $job = new ScanUploadedFileJob($fileRecord);
        $job->handle($scanner, $auditLogger);

        $fileRecord->refresh();

        $this->assertEquals('infected', $fileRecord->status);
        $this->assertEquals('quarantine', $fileRecord->disk);
        $this->assertTrue(Storage::disk('quarantine')->exists($storagePath));
        $this->assertFalse(Storage::disk('nas')->exists($storagePath));
        $this->assertFalse(Storage::disk('staging')->exists($storagePath));

        $this->assertDatabaseHas('audit_logs', [
            'file_record_id' => $fileRecord->id,
            'event' => 'file.scan_infected',
        ]);
    }

    public function test_chunked_upload_and_assembly_flow(): void
    {
        Queue::fake();

        // 1. Initiate
        $initResponse = $this->withHeaders($this->authHeaders())
            ->postJson('/api/v1/files/chunks/initiate', [
                'filename' => 'large_scan.dcm',
                'total_size_bytes' => 2048,
                'total_chunks' => 2,
            ]);

        $initResponse->assertStatus(201);
        $uploadId = $initResponse->json('upload_id');

        // 2. Upload Chunk 1
        $chunk1 = UploadedFile::fake()->createWithContent('chunk_1.part', str_repeat('A', 1024));
        $chunk1Response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/chunks/{$uploadId}", [
                'chunk_number' => 1,
                'chunk' => $chunk1,
            ]);
        $chunk1Response->assertStatus(200);

        // 3. Upload Chunk 2
        $chunk2 = UploadedFile::fake()->createWithContent('chunk_2.part', str_repeat('B', 1024));
        $chunk2Response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/chunks/{$uploadId}", [
                'chunk_number' => 2,
                'chunk' => $chunk2,
            ]);
        $chunk2Response->assertStatus(200);

        // 4. Complete
        $completeResponse = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/chunks/{$uploadId}/complete", [
                'filename' => 'large_scan.dcm',
                'total_chunks' => 2,
            ]);

        $completeResponse->assertStatus(202)
            ->assertJsonPath('file.original_filename', 'large_scan.dcm')
            ->assertJsonPath('file.size_bytes', 2048);

        $fileUuid = $completeResponse->json('file.uuid');
        $this->assertDatabaseHas('file_records', [
            'uuid' => $fileUuid,
            'size_bytes' => 2048,
            'status' => 'pending_scan',
        ]);
    }

    public function test_signed_download_url_generation_and_streaming(): void
    {
        $content = 'Clean payload ready for download.';
        $storagePath = 'uploads/'.$this->client->uuid.'/clean_file.txt';
        Storage::disk('nas')->put($storagePath, $content);

        $fileRecord = FileRecord::create([
            'client_application_id' => $this->client->id,
            'original_filename' => 'clean_file.txt',
            'stored_filename' => 'clean_file.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($content),
            'sha256_checksum' => hash('sha256', $content),
            'disk' => 'nas',
            'storage_path' => $storagePath,
            'status' => 'clean',
        ]);

        // Request signed url
        $urlResponse = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$fileRecord->uuid}/signed-url", [
                'expires_in_minutes' => 30,
            ]);

        $urlResponse->assertStatus(200);
        $downloadUrl = $urlResponse->json('download_url');

        // Access download using signed URL
        $downloadResponse = $this->get($downloadUrl);
        $downloadResponse->assertStatus(200);
        $this->assertEquals($content, $downloadResponse->streamedContent());
    }

    public function test_cannot_generate_download_url_for_infected_or_pending_files(): void
    {
        $fileRecord = FileRecord::create([
            'client_application_id' => $this->client->id,
            'original_filename' => 'bad_file.exe',
            'stored_filename' => 'bad_file.exe',
            'mime_type' => 'application/octet-stream',
            'size_bytes' => 100,
            'sha256_checksum' => 'checksum',
            'disk' => 'quarantine',
            'storage_path' => 'quarantine/bad_file.exe',
            'status' => 'infected',
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$fileRecord->uuid}/signed-url");

        $response->assertStatus(403)
            ->assertJsonPath('error', 'FileUnavailable');
    }

    public function test_multi_tenant_isolation_prevents_access_from_other_clients(): void
    {
        $otherClient = ClientApplication::create([
            'name' => 'Other Tenant',
            'api_key' => 'other-key',
            'api_secret_hash' => Hash::make('other-secret'),
        ]);

        $fileRecord = FileRecord::create([
            'client_application_id' => $this->client->id,
            'original_filename' => 'private_file.pdf',
            'stored_filename' => 'private_file.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 100,
            'sha256_checksum' => 'dummy-sha',
            'disk' => 'nas',
            'storage_path' => 'uploads/test/private_file.pdf',
            'status' => 'clean',
        ]);

        // Attempt to show/access file using otherClient's credentials
        $response = $this->withHeaders([
            'X-API-Key' => 'other-key',
            'X-API-Secret' => 'other-secret',
        ])->getJson("/api/v1/files/{$fileRecord->uuid}");

        $response->assertStatus(404)
            ->assertJsonPath('error', 'NotFound');
    }

    public function test_non_existent_or_external_file_returns_clean_404_json(): void
    {
        $nonExistentUuid = (string) Str::uuid();

        $response = $this->withHeaders($this->authHeaders())
            ->getJson("/api/v1/files/{$nonExistentUuid}");

        $response->assertStatus(404)
            ->assertJson([
                'error' => 'NotFound',
                'message' => 'The requested record could not be found in this system.',
            ]);
    }
}
