<?php

namespace App\Jobs;

use App\Models\FileRecord;
use App\Services\AuditLoggerService;
use App\Services\Scanner\ScannerInterface;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;

class ScanUploadedFileJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public FileRecord $fileRecord
    ) {}

    public function handle(ScannerInterface $scanner, AuditLoggerService $auditLogger): void
    {
        $file = $this->fileRecord->fresh();

        if (! $file || $file->status !== 'pending_scan') {
            return;
        }

        $file->update(['status' => 'scanning']);

        $stagingDisk = Storage::disk('staging');
        $absolutePath = $stagingDisk->path($file->storage_path);

        $scanResult = $scanner->scan($absolutePath);

        if ($scanResult->isClean) {
            // Promote file from staging to NAS storage
            $nasDisk = Storage::disk('nas');
            $fileStream = $stagingDisk->readStream($file->storage_path);

            $nasDisk->writeStream($file->storage_path, $fileStream);
            if (is_resource($fileStream)) {
                fclose($fileStream);
            }

            // Remove from staging
            $stagingDisk->delete($file->storage_path);

            $file->update([
                'disk' => 'nas',
                'status' => 'clean',
                'scan_result' => $scanResult->toArray(),
            ]);

            $auditLogger->log('file.scan_clean', $file->clientApplication, $file, [
                'engine' => $scanResult->engine,
                'metadata' => $scanResult->metadata,
            ]);

            // Dispatch webhook
            dispatch(new DispatchClientWebhookJob(
                clientApp: $file->clientApplication,
                event: 'file.scanned.clean',
                payload: [
                    'file_uuid' => $file->uuid,
                    'status' => 'clean',
                    'filename' => $file->original_filename,
                    'size_bytes' => $file->size_bytes,
                    'sha256' => $file->sha256_checksum,
                ]
            ));
        } else {
            // Threat detected! Move to isolated quarantine disk
            $quarantineDisk = Storage::disk('quarantine');
            $fileStream = $stagingDisk->readStream($file->storage_path);

            $quarantineDisk->writeStream($file->storage_path, $fileStream);
            if (is_resource($fileStream)) {
                fclose($fileStream);
            }

            // Remove from staging
            $stagingDisk->delete($file->storage_path);

            $file->update([
                'disk' => 'quarantine',
                'status' => 'infected',
                'scan_result' => $scanResult->toArray(),
            ]);

            $auditLogger->log('file.scan_infected', $file->clientApplication, $file, [
                'threat' => $scanResult->threatName,
                'engine' => $scanResult->engine,
            ]);

            // Dispatch security warning webhook
            dispatch(new DispatchClientWebhookJob(
                clientApp: $file->clientApplication,
                event: 'file.scanned.infected',
                payload: [
                    'file_uuid' => $file->uuid,
                    'status' => 'infected',
                    'threat_name' => $scanResult->threatName,
                    'filename' => $file->original_filename,
                ]
            ));
        }
    }
}
