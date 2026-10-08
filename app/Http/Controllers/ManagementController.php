<?php

namespace App\Http\Controllers;

use App\Models\ClientApplication;
use App\Models\FileDownloadLink;
use App\Models\FileRecord;
use App\Services\AuditLoggerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class ManagementController extends Controller
{
    public function __construct(
        protected AuditLoggerService $auditLogger
    ) {}

    /**
     * Get system-wide stats overview.
     */
    public function stats(): JsonResponse
    {
        $totalSystems = ClientApplication::count();
        $activeSystems = ClientApplication::where('is_active', true)->count();
        $quarantinedFiles = FileRecord::where(function ($query) {
            $query->where('status', 'infected')
                ->orWhere('disk', 'quarantine');
        })->count();

        $expiredFiles = FileRecord::onlyTrashed()
            ->orWhere(function ($query) {
                $query->whereNotNull('purge_at')
                    ->where('purge_at', '<=', now());
            })->count();

        $totalStorageBytes = (int) FileRecord::sum('size_bytes');

        $activeLinksCount = FileDownloadLink::where('is_revoked', false)
            ->where('expires_at', '>', now())
            ->count();
        $expiredOrRevokedLinksCount = FileDownloadLink::where('is_revoked', true)
            ->orWhere('expires_at', '<=', now())
            ->count();

        return response()->json([
            'total_systems' => $totalSystems,
            'active_systems' => $activeSystems,
            'quarantined_files' => $quarantinedFiles,
            'expired_files' => $expiredFiles,
            'total_storage_bytes' => $totalStorageBytes,
            'clean_files_count' => FileRecord::where('status', 'clean')->count(),
            'active_links_count' => $activeLinksCount,
            'expired_or_revoked_links_count' => $expiredOrRevokedLinksCount,
        ]);
    }

    /**
     * List all connected client systems with their metrics.
     */
    public function getSystems(Request $request): JsonResponse
    {
        $search = $request->query('search');

        $query = ClientApplication::withCount([
            'files',
            'files as clean_files_count' => function ($q) {
                $q->where('status', 'clean');
            },
            'files as quarantined_files_count' => function ($q) {
                $q->where('status', 'infected')->orWhere('disk', 'quarantine');
            },
        ])->withSum('files as total_storage_bytes', 'size_bytes');

        if ($search) {
            $query->where('name', 'like', "%{$search}%")
                ->orWhere('api_key', 'like', "%{$search}%");
        }

        $systems = $query->latest()->get()->map(function ($system) {
            return [
                'id' => $system->id,
                'uuid' => $system->uuid,
                'name' => $system->name,
                'api_key' => $system->api_key,
                'allowed_ips' => $system->allowed_ips ?? [],
                'webhook_url' => $system->webhook_url,
                'is_active' => (bool) $system->is_active,
                'rate_limit_per_minute' => $system->rate_limit_per_minute,
                'files_count' => $system->files_count ?? 0,
                'clean_files_count' => $system->clean_files_count ?? 0,
                'quarantined_files_count' => $system->quarantined_files_count ?? 0,
                'total_storage_bytes' => (int) ($system->total_storage_bytes ?? 0),
                'created_at' => $system->created_at?->toIso8601String(),
                'updated_at' => $system->updated_at?->toIso8601String(),
            ];
        });

        return response()->json(['systems' => $systems]);
    }

    /**
     * Create a new client system.
     */
    public function storeSystem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'webhook_url' => 'nullable|url|max:500',
            'allowed_ips' => 'nullable|array',
            'allowed_ips.*' => 'string',
            'rate_limit_per_minute' => 'nullable|integer|min:1|max:5000',
        ]);

        $apiKey = 'coss_live_'.Str::random(32);
        $plainSecret = Str::random(48);

        $system = ClientApplication::create([
            'uuid' => (string) Str::uuid(),
            'name' => $validated['name'],
            'api_key' => $apiKey,
            'api_secret_hash' => password_hash($plainSecret, PASSWORD_BCRYPT),
            'allowed_ips' => $validated['allowed_ips'] ?? null,
            'webhook_url' => $validated['webhook_url'] ?? null,
            'webhook_secret' => Str::random(32),
            'is_active' => true,
            'rate_limit_per_minute' => $validated['rate_limit_per_minute'] ?? 120,
        ]);

        return response()->json([
            'message' => 'System created successfully.',
            'system' => $system,
            'credentials' => [
                'api_key' => $apiKey,
                'api_secret' => $plainSecret, // Only shown once!
            ],
        ], 201);
    }

    /**
     * Update client system status or configuration.
     */
    public function updateSystem(Request $request, int $id): JsonResponse
    {
        $system = ClientApplication::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'webhook_url' => 'nullable|url|max:500',
            'allowed_ips' => 'nullable|array',
            'allowed_ips.*' => 'string',
            'rate_limit_per_minute' => 'sometimes|integer|min:1|max:5000',
            'is_active' => 'sometimes|boolean',
        ]);

        $system->update($validated);

        return response()->json([
            'message' => 'System updated successfully.',
            'system' => $system,
        ]);
    }

    /**
     * Delete client system.
     */
    public function deleteSystem(int $id): JsonResponse
    {
        $system = ClientApplication::findOrFail($id);
        $system->delete();

        return response()->json([
            'message' => 'System deleted successfully.',
        ]);
    }

    /**
     * Regenerate API Secret for a system.
     */
    public function regenerateSecret(int $id): JsonResponse
    {
        $system = ClientApplication::findOrFail($id);
        $newPlainSecret = Str::random(48);

        $system->update([
            'api_secret_hash' => password_hash($newPlainSecret, PASSWORD_BCRYPT),
        ]);

        return response()->json([
            'message' => 'API Secret regenerated successfully.',
            'api_key' => $system->api_key,
            'api_secret' => $newPlainSecret,
        ]);
    }

    /**
     * List quarantined and expired files.
     */
    public function getQuarantineAndExpiredFiles(Request $request): JsonResponse
    {
        $tab = $request->query('tab', 'all'); // 'quarantine', 'expired', 'soft_deleted', 'all'
        $search = $request->query('search');

        $query = FileRecord::withTrashed()->with('clientApplication:id,name,uuid');

        if ($tab === 'quarantine') {
            $query->where(function ($q) {
                $q->where('status', 'infected')->orWhere('disk', 'quarantine');
            });
        } elseif ($tab === 'expired') {
            $query->where(function ($q) {
                $q->whereNotNull('purge_at')->where('purge_at', '<=', now());
            });
        } elseif ($tab === 'soft_deleted') {
            $query->onlyTrashed();
        } else {
            // All flagged/quarantined or expired
            $query->where(function ($q) {
                $q->where('status', 'infected')
                    ->orWhere('disk', 'quarantine')
                    ->orWhereNotNull('deleted_at')
                    ->orWhere(function ($sub) {
                        $sub->whereNotNull('purge_at')->where('purge_at', '<=', now());
                    });
            });
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('original_filename', 'like', "%{$search}%")
                    ->orWhere('uuid', 'like', "%{$search}%")
                    ->orWhere('sha256_checksum', 'like', "%{$search}%");
            });
        }

        $files = $query->latest('updated_at')->paginate(25);

        return response()->json($files);
    }

    /**
     * Restore a soft-deleted or expired file.
     */
    public function restoreFile(string $uuid): JsonResponse
    {
        $file = FileRecord::withTrashed()->where('uuid', $uuid)->firstOrFail();

        if ($file->trashed()) {
            $file->restore();
        }

        // Reset purge date to 90 days from now
        $file->update([
            'purge_at' => now()->addDays($file->retention_days ?: 90),
        ]);

        return response()->json([
            'message' => "File '{$file->original_filename}' restored successfully.",
            'file' => $file,
        ]);
    }

    /**
     * Permanently delete / purge a quarantined or expired file from disk and database.
     */
    public function purgeFilePermanently(string $uuid): JsonResponse
    {
        $file = FileRecord::withTrashed()->where('uuid', $uuid)->firstOrFail();

        // Remove from physical disk
        try {
            $disk = Storage::disk($file->disk ?: 'staging');
            if ($disk->exists($file->storage_path)) {
                $disk->delete($file->storage_path);
            }
        } catch (\Throwable $e) {
            // Keep going even if file was already removed from storage
        }

        $filename = $file->original_filename;
        $file->forceDelete();

        return response()->json([
            'message' => "File '{$filename}' has been permanently purged.",
        ]);
    }

    /**
     * Override quarantine: mark file as clean and move to nas disk.
     */
    public function releaseQuarantine(string $uuid): JsonResponse
    {
        $file = FileRecord::withTrashed()->where('uuid', $uuid)->firstOrFail();

        $sourceDisk = Storage::disk($file->disk ?: 'staging');
        $targetDisk = Storage::disk('nas');

        $cleanPath = 'clean/'.($file->clientApplication?->uuid ?? 'shared').'/'.$file->stored_filename;

        if ($sourceDisk->exists($file->storage_path)) {
            $stream = $sourceDisk->readStream($file->storage_path);
            if ($stream !== false) {
                $targetDisk->put($cleanPath, $stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
                $sourceDisk->delete($file->storage_path);
            }
        }

        $file->update([
            'disk' => 'nas',
            'storage_path' => $cleanPath,
            'status' => 'clean',
            'scan_result' => array_merge($file->scan_result ?? [], [
                'manual_override' => true,
                'released_at' => now()->toIso8601String(),
                'note' => 'Manually released by administrator',
            ]),
        ]);

        return response()->json([
            'message' => "File '{$file->original_filename}' released from quarantine to NAS storage.",
            'file' => $file,
        ]);
    }

    /**
     * Purge all expired files currently overdue.
     */
    public function purgeAllExpired(): JsonResponse
    {
        $overdue = FileRecord::withTrashed()
            ->where(function ($q) {
                $q->whereNotNull('purge_at')->where('purge_at', '<=', now())
                    ->orWhereNotNull('deleted_at');
            })->get();

        $purgedCount = 0;
        foreach ($overdue as $file) {
            try {
                $disk = Storage::disk($file->disk ?: 'staging');
                if ($disk->exists($file->storage_path)) {
                    $disk->delete($file->storage_path);
                }
            } catch (\Throwable $e) {
                // Ignore disk errors
            }
            $file->forceDelete();
            $purgedCount++;
        }

        return response()->json([
            'message' => "Successfully purged {$purgedCount} expired/deleted files.",
            'purged_count' => $purgedCount,
        ]);
    }

    /**
     * List file download links with filtering.
     */
    public function getDownloadLinks(Request $request): JsonResponse
    {
        $status = $request->query('status', 'all'); // 'all', 'active', 'expired', 'revoked'
        $search = $request->query('search');

        $query = FileDownloadLink::with([
            'fileRecord:id,uuid,original_filename,size_bytes,mime_type,status',
            'clientApplication:id,name,uuid',
        ]);

        if ($status === 'active') {
            $query->where('is_revoked', false)->where('expires_at', '>', now());
        } elseif ($status === 'expired') {
            $query->where('is_revoked', false)->where('expires_at', '<=', now());
        } elseif ($status === 'revoked') {
            $query->where('is_revoked', true);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('token', 'like', "%{$search}%")
                    ->orWhereHas('fileRecord', function ($fq) use ($search) {
                        $fq->where('original_filename', 'like', "%{$search}%")
                            ->orWhere('uuid', 'like', "%{$search}%");
                    })
                    ->orWhereHas('clientApplication', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $links = $query->latest()->paginate(25);

        // Append computed full URL (preferring the stable original_signed_url)
        $links->getCollection()->transform(function ($link) {
            $url = $link->original_signed_url;
            if (! $url && $link->fileRecord) {
                $routeParams = [
                    'uuid' => $link->fileRecord->uuid,
                    'link' => $link->token,
                ];
                $url = $link->expires_at
                    ? URL::temporarySignedRoute('api.files.download', $link->expires_at, $routeParams)
                    : URL::signedRoute('api.files.download', $routeParams);
            }

            $portalUrl = url("/d/{$link->token}");

            return array_merge($link->toArray(), [
                'portal_url' => $portalUrl,
                'download_url' => $url,
                'api_signed_url' => $url,
                'is_expired' => $link->isExpired(),
                'has_password' => ! empty($link->password_hash),
            ]);
        });

        return response()->json($links);
    }

    /**
     * Create a download link manually from the management dashboard.
     */
    public function createDownloadLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file_uuid' => 'required|string|exists:file_records,uuid',
            'expires_in_minutes' => 'nullable|integer|min:0|max:10080',
            'max_downloads' => 'nullable|integer|min:1|max:10000',
            'allowed_ips' => 'nullable|array',
            'allowed_ips.*' => 'string',
            'password' => 'nullable|string|min:4|max:100',
        ]);

        $file = FileRecord::where('uuid', $validated['file_uuid'])->firstOrFail();

        if ($file->status !== 'clean') {
            return response()->json([
                'error' => 'FileUnavailable',
                'message' => "Only clean files can have download links generated (Current status: {$file->status}).",
            ], 422);
        }

        $expiresInMinutes = ! empty($validated['expires_in_minutes']) ? (int) $validated['expires_in_minutes'] : null;
        $expiresAt = $expiresInMinutes ? now()->addMinutes($expiresInMinutes) : null;
        $maxDownloads = isset($validated['max_downloads']) ? (int) $validated['max_downloads'] : null;
        $allowedIps = $validated['allowed_ips'] ?? null;
        $password = $validated['password'] ?? null;

        $token = (string) Str::uuid();
        $routeParams = [
            'uuid' => $file->uuid,
            'link' => $token,
        ];

        $signedUrl = $expiresAt
            ? URL::temporarySignedRoute('api.files.download', $expiresAt, $routeParams)
            : URL::signedRoute('api.files.download', $routeParams);

        $link = FileDownloadLink::create([
            'token' => $token,
            'original_signed_url' => $signedUrl,
            'file_record_id' => $file->id,
            'client_application_id' => $file->client_application_id,
            'max_downloads' => $maxDownloads,
            'download_count' => 0,
            'allowed_ips' => $allowedIps,
            'password_hash' => $password ? Hash::make($password) : null,
            'is_revoked' => false,
            'expires_at' => $expiresAt,
        ]);

        $this->auditLogger->log('management.link_created', $file->clientApplication, $file, [
            'link_token' => $link->token,
            'expires_at' => $expiresAt?->toIso8601String(),
            'max_downloads' => $maxDownloads,
            'allowed_ips' => $allowedIps,
            'has_password' => ! empty($password),
        ], $request);

        $portalUrl = url("/d/{$link->token}");

        return response()->json([
            'message' => 'Download link created successfully.',
            'link' => array_merge($link->toArray(), [
                'portal_url' => $portalUrl,
                'download_url' => $signedUrl,
                'api_signed_url' => $signedUrl,
                'has_password' => ! empty($password),
                'file_record' => $file,
            ]),
        ], 201);
    }

    /**
     * Revoke or reactivate an active download link.
     */
    public function toggleRevokeDownloadLink(string $token): JsonResponse
    {
        $link = FileDownloadLink::where('token', $token)->firstOrFail();
        $link->update([
            'is_revoked' => ! $link->is_revoked,
        ]);

        $action = $link->is_revoked ? 'revoked' : 're-activated';

        $this->auditLogger->log('management.link_revocation_toggled', $link->clientApplication, $link->fileRecord, [
            'link_token' => $token,
            'is_revoked' => $link->is_revoked,
        ]);

        return response()->json([
            'message' => "Download link successfully {$action}.",
            'link' => $link,
        ]);
    }

    /**
     * Update restrictions for an existing download link.
     */
    public function updateDownloadLink(Request $request, string $token): JsonResponse
    {
        $link = FileDownloadLink::where('token', $token)->firstOrFail();

        $validated = $request->validate([
            'expires_at' => 'nullable|date',
            'expires_in_minutes' => 'nullable|integer|min:1|max:10080',
            'max_downloads' => 'nullable|integer|min:1|max:10000',
            'allowed_ips' => 'nullable|array',
            'allowed_ips.*' => 'string',
            'password' => 'nullable|string|min:4|max:100',
            'clear_password' => 'nullable|boolean',
            'clear_max_downloads' => 'nullable|boolean',
            'clear_allowed_ips' => 'nullable|boolean',
            'clear_expires_at' => 'nullable|boolean',
        ]);

        $updates = [];

        if (! empty($validated['clear_expires_at'])) {
            $updates['expires_at'] = null;
            // Generate a permanent signed route URL
            $updates['original_signed_url'] = URL::signedRoute('api.files.download', [
                'uuid' => $link->fileRecord->uuid,
                'link' => $link->token,
            ]);
        } elseif (! empty($validated['expires_at'])) {
            $updates['expires_at'] = Carbon::parse($validated['expires_at'])->setTimezone(config('app.timezone'));
            $updates['original_signed_url'] = URL::temporarySignedRoute('api.files.download', $updates['expires_at'], [
                'uuid' => $link->fileRecord->uuid,
                'link' => $link->token,
            ]);
        } elseif (! empty($validated['expires_in_minutes'])) {
            $updates['expires_at'] = now()->addMinutes((int) $validated['expires_in_minutes']);
            $updates['original_signed_url'] = URL::temporarySignedRoute('api.files.download', $updates['expires_at'], [
                'uuid' => $link->fileRecord->uuid,
                'link' => $link->token,
            ]);
        }

        if (! empty($validated['clear_max_downloads'])) {
            $updates['max_downloads'] = null;
        } elseif (array_key_exists('max_downloads', $validated)) {
            $updates['max_downloads'] = $validated['max_downloads'];
        }

        if (! empty($validated['clear_allowed_ips'])) {
            $updates['allowed_ips'] = null;
        } elseif (array_key_exists('allowed_ips', $validated)) {
            $updates['allowed_ips'] = $validated['allowed_ips'];
        }

        if (! empty($validated['clear_password'])) {
            $updates['password_hash'] = null;
        } elseif (! empty($validated['password'])) {
            $updates['password_hash'] = Hash::make($validated['password']);
        }

        $link->update($updates);

        $downloadUrl = $link->original_signed_url;
        if (! $downloadUrl && $link->fileRecord) {
            $routeParams = [
                'uuid' => $link->fileRecord->uuid,
                'link' => $link->token,
            ];
            $downloadUrl = $link->expires_at
                ? URL::temporarySignedRoute('api.files.download', $link->expires_at, $routeParams)
                : URL::signedRoute('api.files.download', $routeParams);
        }

        $this->auditLogger->log('management.link_restrictions_updated', $link->clientApplication, $link->fileRecord, [
            'link_token' => $token,
            'updated_fields' => array_keys($updates),
        ], $request);

        $portalUrl = url("/d/{$link->token}");

        return response()->json([
            'message' => 'Link restrictions updated successfully.',
            'link' => array_merge($link->fresh()->toArray(), [
                'portal_url' => $portalUrl,
                'download_url' => $downloadUrl,
                'api_signed_url' => $downloadUrl,
                'has_password' => ! empty($link->password_hash),
                'is_expired' => $link->isExpired(),
            ]),
        ]);
    }

    /**
     * Purge expired and revoked links from database.
     */
    public function purgeExpiredDownloadLinks(): JsonResponse
    {
        $count = FileDownloadLink::where('is_revoked', true)
            ->orWhere('expires_at', '<=', now())
            ->delete();

        return response()->json([
            'message' => "Successfully purged {$count} expired/revoked download links.",
            'purged_count' => $count,
        ]);
    }
}
