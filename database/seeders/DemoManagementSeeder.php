<?php

namespace Database\Seeders;

use App\Models\ClientApplication;
use App\Models\FileRecord;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoManagementSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (ClientApplication::count() === 0) {
            $ehr = ClientApplication::create([
                'uuid' => (string) Str::uuid(),
                'name' => 'Hospital EHR System',
                'api_key' => 'coss_live_ehr_demo_772199',
                'api_secret_hash' => password_hash('secret123', PASSWORD_BCRYPT),
                'allowed_ips' => ['192.168.1.10', '192.168.1.11'],
                'webhook_url' => 'https://ehr.hospital.local/api/coss/webhook',
                'webhook_secret' => 'whsec_demo_123',
                'is_active' => true,
                'rate_limit_per_minute' => 300,
            ]);

            $lis = ClientApplication::create([
                'uuid' => (string) Str::uuid(),
                'name' => 'Laboratory Information System (LIS)',
                'api_key' => 'coss_live_lis_demo_883200',
                'api_secret_hash' => password_hash('secret123', PASSWORD_BCRYPT),
                'allowed_ips' => ['10.0.4.5'],
                'webhook_url' => 'https://lis.hospital.local/api/v1/scan-results',
                'webhook_secret' => 'whsec_demo_lis',
                'is_active' => true,
                'rate_limit_per_minute' => 180,
            ]);

            $pacs = ClientApplication::create([
                'uuid' => (string) Str::uuid(),
                'name' => 'Radiology & PACS Gateway',
                'api_key' => 'coss_live_pacs_demo_994311',
                'api_secret_hash' => password_hash('secret123', PASSWORD_BCRYPT),
                'allowed_ips' => ['172.16.0.22'],
                'webhook_url' => 'https://pacs.hospital.local/webhooks/file-events',
                'webhook_secret' => 'whsec_demo_pacs',
                'is_active' => false,
                'rate_limit_per_minute' => 60,
            ]);

            // Quarantined file 1 (infected)
            FileRecord::create([
                'uuid' => (string) Str::uuid(),
                'client_application_id' => $ehr->id,
                'original_filename' => 'patient_records_archive.zip',
                'stored_filename' => 'quarantine_sample_zip.bin',
                'mime_type' => 'application/zip',
                'size_bytes' => 1542031,
                'sha256_checksum' => 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                'disk' => 'quarantine',
                'storage_path' => 'quarantine/'.$ehr->uuid.'/quarantine_sample_zip.bin',
                'status' => 'infected',
                'scan_result' => ['threat' => 'Win32.Trojan.Generic', 'engine' => 'ClamAV 1.4', 'timestamp' => now()->toIso8601String()],
                'retention_days' => 30,
                'purge_at' => now()->addDays(7),
            ]);

            // Quarantined file 2 (infected macro)
            FileRecord::create([
                'uuid' => (string) Str::uuid(),
                'client_application_id' => $ehr->id,
                'original_filename' => 'supplier_invoice_macro.xlsm',
                'stored_filename' => 'quarantine_macro_doc.bin',
                'mime_type' => 'application/vnd.ms-excel.sheet.macroEnabled.12',
                'size_bytes' => 842100,
                'sha256_checksum' => 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
                'disk' => 'quarantine',
                'storage_path' => 'quarantine/'.$ehr->uuid.'/quarantine_macro_doc.bin',
                'status' => 'infected',
                'scan_result' => ['threat' => 'VBA.Downloader.Agent', 'engine' => 'ClamAV 1.4', 'timestamp' => now()->subDays(2)->toIso8601String()],
                'retention_days' => 14,
                'purge_at' => now()->subDays(1),
            ]);

            // Expired file (clean but past retention purge_at)
            FileRecord::create([
                'uuid' => (string) Str::uuid(),
                'client_application_id' => $lis->id,
                'original_filename' => 'blood_chemistry_q1_2024.pdf',
                'stored_filename' => 'expired_lab_report.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => 450210,
                'sha256_checksum' => '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                'disk' => 'staging',
                'storage_path' => 'uploads/'.$lis->uuid.'/expired_lab_report.pdf',
                'status' => 'clean',
                'retention_days' => 90,
                'purge_at' => now()->subDays(12),
            ]);

            // Soft-deleted file awaiting purge
            $trashed = FileRecord::create([
                'uuid' => (string) Str::uuid(),
                'client_application_id' => $lis->id,
                'original_filename' => 'temp_worklist_batch_992.csv',
                'stored_filename' => 'temp_worklist_batch_992.csv',
                'mime_type' => 'text/csv',
                'size_bytes' => 12400,
                'sha256_checksum' => 'c1d2e3f4a5b6c7d8e9f0123456789abcdef0123456789abcdef0123456789abc',
                'disk' => 'staging',
                'storage_path' => 'uploads/'.$lis->uuid.'/temp_worklist_batch_992.csv',
                'status' => 'clean',
                'retention_days' => 7,
                'purge_at' => now()->addDays(2),
            ]);
            $trashed->delete();

            // Clean active file on NAS
            FileRecord::create([
                'uuid' => (string) Str::uuid(),
                'client_application_id' => $pacs->id,
                'original_filename' => 'mri_scan_patient_0091.dcm',
                'stored_filename' => 'clean_mri_0091.dcm',
                'mime_type' => 'application/dicom',
                'size_bytes' => 52428800,
                'sha256_checksum' => '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
                'disk' => 'nas',
                'storage_path' => 'clean/'.$pacs->uuid.'/clean_mri_0091.dcm',
                'status' => 'clean',
                'retention_days' => 365,
                'purge_at' => now()->addDays(360),
            ]);
        }
    }
}
