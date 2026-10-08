<?php

namespace App\Http\Controllers;

use App\Models\FileDownloadLink;
use App\Services\AuditLoggerService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PortalDownloadController extends Controller
{
    public function __construct(
        protected AuditLoggerService $auditLogger
    ) {}

    /**
     * Show the short portal download page or stream the file directly.
     */
    public function show(Request $request, string $token): View|StreamedResponse|JsonResponse
    {
        $linkRecord = FileDownloadLink::with(['fileRecord.clientApplication'])->where('token', $token)->first();

        $accept = $request->header('Accept', '');
        $isViewRequest = $request->boolean('view');
        $isStreamRequest = $request->boolean('stream');
        $isBrowserNavigation = str_contains($accept, 'text/html') && ! $request->expectsJson() && ! $isStreamRequest && ! $isViewRequest;

        // If it's standard browser navigation and not requesting direct stream/view, render portal UI
        if ($isBrowserNavigation) {
            return view('app');
        }

        if (! $linkRecord || ! $linkRecord->fileRecord) {
            return response()->json([
                'error' => 'LinkNotFound',
                'message' => 'The download link token is invalid or has expired.',
            ], Response::HTTP_NOT_FOUND);
        }

        $file = $linkRecord->fileRecord;

        // 1. File status check
        if ($file->status !== 'clean') {
            return response()->json([
                'error' => 'FileUnavailable',
                'message' => 'File is not in clean status.',
            ], Response::HTTP_FORBIDDEN);
        }

        // 2. Revocation check
        if ($linkRecord->is_revoked) {
            return response()->json([
                'error' => 'LinkRevoked',
                'message' => 'This download link has been revoked by an administrator or client.',
            ], Response::HTTP_FORBIDDEN);
        }

        // 3. Expiration check
        if ($linkRecord->isExpired()) {
            return response()->json([
                'error' => 'LinkExpired',
                'message' => 'This download link has expired.',
            ], Response::HTTP_GONE);
        }

        // 4. Download limit check
        if ($linkRecord->hasReachedDownloadLimit()) {
            return response()->json([
                'error' => 'DownloadLimitReached',
                'message' => 'The maximum allowed download limit for this link has been reached.',
            ], Response::HTTP_FORBIDDEN);
        }

        // 5. IP restriction check
        $clientIp = $request->ip();
        if (! $linkRecord->isIpAuthorized($clientIp)) {
            $this->auditLogger->log('file.download_ip_blocked', $file->clientApplication, $file, [
                'ip' => $clientIp,
                'allowed_ips' => $linkRecord->allowed_ips,
                'link_token' => $token,
            ], $request);

            return response()->json([
                'error' => 'IpRestrictionDenied',
                'message' => "Access denied. Your IP address ({$clientIp}) is not authorized to use this download link.",
            ], Response::HTTP_FORBIDDEN);
        }

        // 6. Password protection check
        if ($linkRecord->password_hash) {
            $providedPassword = $request->header('X-Download-Password')
                ?? $request->query('password');

            if (! $providedPassword || ! Hash::check($providedPassword, $linkRecord->password_hash)) {
                return response()->json([
                    'error' => 'PasswordRequired',
                    'message' => 'This download link requires a valid password. Provide via X-Download-Password header or password query parameter.',
                ], Response::HTTP_UNAUTHORIZED);
            }
        }

        $nasDisk = Storage::disk($file->disk ?: 'nas');
        if (! $nasDisk->exists($file->storage_path)) {
            return response()->json([
                'error' => 'FileNotFoundOnStorage',
                'message' => 'The physical file was not found on NAS storage.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Increment count
        $linkRecord->increment('download_count');
        $linkRecord->update(['last_accessed_at' => now()]);

        $actionType = $isViewRequest ? 'file.inline_view' : 'file.streamed_download';
        $this->auditLogger->log($actionType, $file->clientApplication, $file, [
            'filename' => $file->original_filename,
            'size_bytes' => $file->size_bytes,
            'link_token' => $token,
            'is_view' => $isViewRequest,
            'download_count' => $linkRecord->download_count,
        ], $request);

        $headers = [
            'Content-Type' => $file->mime_type,
            'Content-Length' => $file->size_bytes,
            'Accept-Ranges' => 'bytes',
        ];

        if ($isViewRequest) {
            return $nasDisk->response($file->storage_path, $file->original_filename, $headers, 'inline');
        }

        return $nasDisk->download($file->storage_path, $file->original_filename, $headers);
    }

    /**
     * Get link info and file metadata for the short portal UI.
     */
    public function info(Request $request, string $token): JsonResponse
    {
        $linkRecord = FileDownloadLink::with(['fileRecord.clientApplication'])->where('token', $token)->first();

        if (! $linkRecord || ! $linkRecord->fileRecord) {
            return response()->json([
                'error' => 'LinkNotFound',
                'message' => 'The download link is invalid or has expired.',
            ], Response::HTTP_NOT_FOUND);
        }

        $file = $linkRecord->fileRecord;
        $clientIp = $request->ip();

        return response()->json([
            'file' => [
                'uuid' => $file->uuid,
                'original_filename' => $file->original_filename,
                'mime_type' => $file->mime_type,
                'size_bytes' => $file->size_bytes,
                'status' => $file->status,
                'client_name' => $file->clientApplication?->name ?? 'Internal Hospital System',
            ],
            'link' => [
                'token' => $linkRecord->token,
                'expires_at' => $linkRecord->expires_at?->toIso8601String(),
                'max_downloads' => $linkRecord->max_downloads,
                'download_count' => $linkRecord->download_count ?? 0,
                'has_password' => ! empty($linkRecord->password_hash),
                'is_expired' => $linkRecord->isExpired(),
                'is_revoked' => (bool) $linkRecord->is_revoked,
                'limit_reached' => $linkRecord->hasReachedDownloadLimit(),
                'ip_authorized' => $linkRecord->isIpAuthorized($clientIp),
                'client_ip' => $clientIp,
            ],
        ]);
    }
}
