<?php

namespace Tests\Feature;

use App\Models\ClientApplication;
use App\Models\FileDownloadLink;
use App\Models\FileRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FileLinkUpdateExpirationTest extends TestCase
{
    use RefreshDatabase;

    protected ClientApplication $client;

    protected FileRecord $cleanFile;

    protected string $fileContent = 'Test content for link expiration testing';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('staging');
        Storage::fake('nas');
        Storage::fake('quarantine');

        $this->client = ClientApplication::create([
            'name' => 'Internal EHR Test',
            'api_key' => 'ehr-test-api-key',
            'api_secret_hash' => Hash::make('secret123'),
            'is_active' => true,
        ]);

        $storagePath = 'uploads/'.$this->client->uuid.'/test_doc.pdf';
        Storage::disk('nas')->put($storagePath, $this->fileContent);

        $this->cleanFile = FileRecord::create([
            'client_application_id' => $this->client->id,
            'original_filename' => 'test_doc.pdf',
            'stored_filename' => 'test_doc.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => strlen($this->fileContent),
            'sha256_checksum' => hash('sha256', $this->fileContent),
            'disk' => 'nas',
            'storage_path' => $storagePath,
            'status' => 'clean',
        ]);
    }

    public function test_updating_link_expiration_via_iso_string_updates_db_and_generates_valid_signed_url(): void
    {
        // 1. Create initial link expiring in 30 minutes
        $initialExpiry = now()->addMinutes(30);
        $link = FileDownloadLink::create([
            'token' => 'test-token-uuid-1',
            'file_record_id' => $this->cleanFile->id,
            'client_application_id' => $this->client->id,
            'is_revoked' => false,
            'expires_at' => $initialExpiry,
        ]);

        // 2. Update expiration to 5 hours from now using ISO 8601 string
        $newTargetTime = now()->addHours(5)->startOfSecond();
        $isoString = $newTargetTime->toISOString();

        $response = $this->putJson("/api/management/links/{$link->token}", [
            'expires_at' => $isoString,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Link restrictions updated successfully.')
            ->assertJsonPath('link.is_expired', false);

        $newDownloadUrl = $response->json('link.download_url');
        $this->assertNotEmpty($newDownloadUrl);

        // 3. Verify database updated
        $link->refresh();
        $this->assertEquals($newTargetTime->timestamp, $link->expires_at->timestamp);

        // 4. Verify the new download URL works and streams content
        $downloadResponse = $this->get($newDownloadUrl);
        $downloadResponse->assertStatus(200);
        $this->assertEquals($this->fileContent, $downloadResponse->streamedContent());

        // 5. Verify the info endpoint works when portal loads it
        $infoUrl = str_replace("/download/{$this->cleanFile->uuid}?", "/download/{$this->cleanFile->uuid}/info?", $newDownloadUrl);
        $infoResponse = $this->getJson($infoUrl);
        $infoResponse->assertStatus(200)
            ->assertJsonPath('link.is_expired', false);
    }

    public function test_updating_link_expiration_to_past_marks_link_expired_and_download_is_rejected(): void
    {
        $link = FileDownloadLink::create([
            'token' => 'test-token-uuid-2',
            'file_record_id' => $this->cleanFile->id,
            'client_application_id' => $this->client->id,
            'is_revoked' => false,
            'expires_at' => now()->addMinutes(30),
        ]);

        $pastTime = now()->subMinutes(10)->startOfSecond();
        $response = $this->putJson("/api/management/links/{$link->token}", [
            'expires_at' => $pastTime->toISOString(),
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('link.is_expired', true);

        $link->refresh();
        $this->assertTrue($link->isExpired());

        $newDownloadUrl = $response->json('link.download_url');
        // Downloading with expired URL must fail (either signature expired or link expired check)
        $downloadResp = $this->get($newDownloadUrl);
        $this->assertTrue(in_array($downloadResp->status(), [403, 410], true));
    }
}
