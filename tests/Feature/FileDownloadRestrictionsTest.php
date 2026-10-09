<?php

namespace Tests\Feature;

use App\Models\ClientApplication;
use App\Models\FileDownloadLink;
use App\Models\FileRecord;
use App\Models\User;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class FileDownloadRestrictionsTest extends TestCase
{
    use RefreshDatabase;

    protected ClientApplication $client;

    protected string $plainSecret = 'super-secret-key-123';

    protected FileRecord $cleanFile;

    protected string $fileContent = 'Confidential Patient Record for Testing';

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

        $storagePath = 'uploads/'.$this->client->uuid.'/test_record.pdf';
        Storage::disk('nas')->put($storagePath, $this->fileContent);

        $this->cleanFile = FileRecord::create([
            'client_application_id' => $this->client->id,
            'original_filename' => 'patient_report.pdf',
            'stored_filename' => 'test_record.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => strlen($this->fileContent),
            'sha256_checksum' => hash('sha256', $this->fileContent),
            'disk' => 'nas',
            'storage_path' => $storagePath,
            'status' => 'clean',
        ]);

        $this->seed(SuperAdminSeeder::class);
    }

    protected function authHeaders(): array
    {
        return [
            'X-API-Key' => $this->client->api_key,
            'X-API-Secret' => $this->plainSecret,
        ];
    }

    public function test_signed_url_generation_supports_restrictions_parameters(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$this->cleanFile->uuid}/signed-url", [
                'expires_in_minutes' => 60,
                'max_downloads' => 3,
                'allowed_ips' => ['127.0.0.1', '192.168.1.100'],
                'password' => 'SecurePass123!',
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['download_url', 'link_token', 'expires_at', 'max_downloads', 'password_required'])
            ->assertJsonPath('max_downloads', 3)
            ->assertJsonPath('password_required', true);

        $token = $response->json('link_token');

        $this->assertDatabaseHas('file_download_links', [
            'token' => $token,
            'file_record_id' => $this->cleanFile->id,
            'client_application_id' => $this->client->id,
            'max_downloads' => 3,
            'download_count' => 0,
            'is_revoked' => false,
        ]);
    }

    public function test_link_enforces_max_downloads_limit(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$this->cleanFile->uuid}/signed-url", [
                'max_downloads' => 2,
            ]);

        $downloadUrl = $response->json('download_url');

        // First download - Success
        $resp1 = $this->get($downloadUrl);
        $resp1->assertStatus(200);
        $this->assertEquals($this->fileContent, $resp1->streamedContent());

        // Second download - Success
        $resp2 = $this->get($downloadUrl);
        $resp2->assertStatus(200);

        // Third download - Exceeded limit
        $resp3 = $this->get($downloadUrl);
        $resp3->assertStatus(403)
            ->assertJsonPath('error', 'DownloadLimitReached');
    }

    public function test_link_enforces_ip_restriction(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$this->cleanFile->uuid}/signed-url", [
                'allowed_ips' => ['192.168.1.50'],
            ]);

        $downloadUrl = $response->json('download_url');

        // Access from unauthorized IP (default 127.0.0.1)
        $respUnauthorized = $this->get($downloadUrl, ['REMOTE_ADDR' => '10.0.0.99']);
        $respUnauthorized->assertStatus(403)
            ->assertJsonPath('error', 'IpRestrictionDenied');

        // Access from authorized IP
        $respAuthorized = $this->withServerVariables(['REMOTE_ADDR' => '192.168.1.50'])->get($downloadUrl);
        $respAuthorized->assertStatus(200);
    }

    public function test_link_enforces_password_protection(): void
    {
        $password = 'SecretMedicalDoc2026';
        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$this->cleanFile->uuid}/signed-url", [
                'password' => $password,
            ]);

        $downloadUrl = $response->json('download_url');

        // Try download without password
        $unauthResp = $this->get($downloadUrl);
        $unauthResp->assertStatus(401)
            ->assertJsonPath('error', 'PasswordRequired');

        // Try download with wrong password
        $wrongPassResp = $this->get($downloadUrl, [
            'X-Download-Password' => 'WrongPassword',
        ]);
        $wrongPassResp->assertStatus(401)
            ->assertJsonPath('error', 'PasswordRequired');

        // Download with correct password header
        $correctPassResp = $this->get($downloadUrl, [
            'X-Download-Password' => $password,
        ]);
        $correctPassResp->assertStatus(200);

        // Download with password query parameter
        $paramPassResp = $this->get($downloadUrl.'&password='.$password);
        $paramPassResp->assertStatus(200);
    }

    public function test_revoked_link_is_blocked_immediately(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$this->cleanFile->uuid}/signed-url");

        $downloadUrl = $response->json('download_url');
        $token = $response->json('link_token');
        $superadmin = User::where('username', 'superadmin')->first();

        // Revoke the link via management toggle
        $toggleResp = $this->actingAs($superadmin)->postJson("/api/management/links/{$token}/revoke-toggle");
        $toggleResp->assertStatus(200)
            ->assertJsonPath('link.is_revoked', true);

        // Access download now -> blocked
        $blockedResp = $this->get($downloadUrl);
        $blockedResp->assertStatus(403)
            ->assertJsonPath('error', 'LinkRevoked');

        // Reactivate the link
        $this->postJson("/api/management/links/{$token}/revoke-toggle")
            ->assertStatus(200)
            ->assertJsonPath('link.is_revoked', false);

        // Access download again -> allowed
        $this->get($downloadUrl)->assertStatus(200);
    }

    public function test_expired_link_is_rejected(): void
    {
        $link = FileDownloadLink::create([
            'token' => 'expired-token-uuid',
            'file_record_id' => $this->cleanFile->id,
            'client_application_id' => $this->client->id,
            'is_revoked' => false,
            'expires_at' => now()->subMinutes(10), // expired 10 minutes ago
        ]);

        $this->assertTrue($link->isExpired());
    }

    public function test_management_api_can_list_filter_and_create_links(): void
    {
        $superadmin = User::where('username', 'superadmin')->first();

        // 1. Create a link via Management API
        $createResp = $this->actingAs($superadmin)->postJson('/api/management/links', [
            'file_uuid' => $this->cleanFile->uuid,
            'expires_in_minutes' => 120,
            'max_downloads' => 5,
            'password' => 'Passcode123',
        ]);

        $createResp->assertStatus(201)
            ->assertJsonPath('link.max_downloads', 5)
            ->assertJsonPath('link.has_password', true);

        // 2. List links
        $listResp = $this->actingAs($superadmin)->getJson('/api/management/links');
        $listResp->assertStatus(200);
        $this->assertNotEmpty($listResp->json('data'));

        // 3. Purge expired links endpoint
        $purgeResp = $this->actingAs($superadmin)->postJson('/api/management/links/purge-expired');
        $purgeResp->assertStatus(200)
            ->assertJsonStructure(['message', 'purged_count']);
    }

    public function test_link_supports_inline_file_view(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$this->cleanFile->uuid}/signed-url", [
                'expires_in_minutes' => 60,
            ]);

        $downloadUrl = $response->json('download_url');

        // Request inline view with ?view=1
        $viewUrl = $downloadUrl.'&view=1';
        $viewResp = $this->get($viewUrl);

        $viewResp->assertStatus(200);
        $viewResp->assertHeader('Content-Disposition', 'inline; filename=patient_report.pdf');
        $viewResp->assertHeader('Content-Type', 'application/pdf');
        $this->assertEquals($this->fileContent, $viewResp->streamedContent());
    }

    public function test_signed_url_creation_returns_portal_url(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$this->cleanFile->uuid}/signed-url", [
                'expires_in_minutes' => 60,
            ]);

        $response->assertStatus(200);
        $token = $response->json('link_token');
        $portalUrl = $response->json('portal_url');

        $this->assertNotEmpty($token);
        $this->assertStringContainsString('/d/'.$token, $portalUrl);
    }

    public function test_short_portal_routes_serve_app_view_when_restricted_and_stream_when_unrestricted(): void
    {
        $link = FileDownloadLink::create([
            'token' => (string) Str::uuid(),
            'file_record_id' => $this->cleanFile->id,
            'client_application_id' => $this->client->id,
            'download_count' => 0,
            'is_revoked' => false,
            'expires_at' => now()->addHour(),
        ]);

        // 1. Browser visit to fully allowed unrestricted link streams directly without GUI
        $portalResp = $this->get('/d/'.$link->token, ['Accept' => 'text/html']);
        $portalResp->assertStatus(200);
        $this->assertEquals($this->fileContent, $portalResp->streamedContent());

        // 2. Info request to /d/{token}/info returns metadata
        $infoResp = $this->getJson('/d/'.$link->token.'/info');
        $infoResp->assertStatus(200)
            ->assertJsonPath('file.original_filename', 'patient_report.pdf')
            ->assertJsonPath('file.status', 'clean')
            ->assertJsonPath('link.is_expired', false);

        // 3. Browser visit to restricted link (e.g. revoked) renders GUI app
        $link->update(['is_revoked' => true]);
        $revokedBrowserResp = $this->get('/d/'.$link->token, ['Accept' => 'text/html']);
        $revokedBrowserResp->assertStatus(200);
        $revokedBrowserResp->assertViewIs('app');
    }

    public function test_short_portal_with_password_enforcement(): void
    {
        $link = FileDownloadLink::create([
            'token' => (string) Str::uuid(),
            'file_record_id' => $this->cleanFile->id,
            'client_application_id' => $this->client->id,
            'download_count' => 0,
            'password_hash' => Hash::make('SecretPass123'),
            'is_revoked' => false,
            'expires_at' => now()->addHour(),
        ]);

        // Browser navigation with password protection renders GUI app to enter password
        $guiResp = $this->get('/d/'.$link->token, ['Accept' => 'text/html']);
        $guiResp->assertStatus(200);
        $guiResp->assertViewIs('app');

        // Direct stream without password should be 401
        $deniedResp = $this->getJson('/d/'.$link->token.'?stream=1');
        $deniedResp->assertStatus(401)
            ->assertJsonPath('error', 'PasswordRequired');

        // Direct stream with correct password in query
        $streamResp = $this->get('/d/'.$link->token.'?stream=1&password=SecretPass123');
        $streamResp->assertStatus(200);
        $this->assertEquals($this->fileContent, $streamResp->streamedContent());
    }

    public function test_browser_navigation_redirects_from_api_download_to_short_portal(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson("/api/v1/files/{$this->cleanFile->uuid}/signed-url", [
                'expires_in_minutes' => 60,
            ]);

        $downloadUrl = $response->json('download_url');
        $token = $response->json('link_token');

        // Browser navigation with text/html header
        $browserResp = $this->get($downloadUrl, [
            'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9',
            'X-Simulate-Browser' => '1',
        ]);

        $browserResp->assertStatus(302);
        $browserResp->assertRedirect(url('/d/'.$token));
    }
}
