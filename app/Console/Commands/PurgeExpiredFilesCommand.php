<?php

namespace App\Console\Commands;

use App\Models\FileRecord;
use App\Services\AuditLoggerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PurgeExpiredFilesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'coss:purge-expired-files';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Permanently purge soft-deleted files past their retention expiration period';

    /**
     * Execute the console command.
     */
    public function handle(AuditLoggerService $auditLogger): int
    {
        $this->info('Starting expired file purge scan...');

        $expiredFiles = FileRecord::onlyTrashed()
            ->whereNotNull('purge_at')
            ->where('purge_at', '<=', now())
            ->get();

        $count = 0;

        foreach ($expiredFiles as $file) {
            $disk = Storage::disk($file->disk);

            if ($disk->exists($file->storage_path)) {
                $disk->delete($file->storage_path);
            }

            $auditLogger->log('file.permanently_purged', $file->clientApplication, $file, [
                'storage_path' => $file->storage_path,
                'disk' => $file->disk,
                'purged_at' => now()->toIso8601String(),
            ]);

            $file->forceDelete();
            $count++;
        }

        $this->info("Purge completed: {$count} expired files permanently erased.");

        return Command::SUCCESS;
    }
}
