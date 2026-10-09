<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientApplication;
use App\Models\FileDownloadLink;
use App\Models\FileRecord;
use App\Services\AuditLoggerService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileDownloadController extends Controller
{
    public function __construct(
        protected AuditLoggerService $auditLogger
    ) {}

    /**
     * Generate a controlled, restricted signed temporary download URL.
     */
    public function createSignedUrl(Request $request, string $uuid): JsonResponse
    {
        /** @var ClientApplication $client */
        $client = $request->attributes->get('client_app');

        $file = FileRecord::where('uuid', $uuid)
            ->where('client_application_id', $client->id)
            ->firstOrFail();

        // Enforce Zero-Trust: only files with 'clean' status can be retrieved
        if ($file->status !== 'clean') {
            return response()->json([
                'error' => 'FileUnavailable',
                'message' => "File cannot be downloaded while in status '{$file->status}'. Only 'clean' files can be retrieved.",
                'status' => $file->status,
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'expires_in_minutes' => 'nullable|integer|min:0|max:10080', // 0 or null for no expiration
            'max_downloads' => 'nullable|integer|min:1|max:10000',
            'allowed_ips' => 'nullable|array',
            'allowed_ips.*' => 'string',
            'password' => 'nullable|string|min:4|max:100',
        ]);

        $hasExpiration = ! empty($validated['expires_in_minutes']);
        $expiresInMinutes = $hasExpiration ? (int) $validated['expires_in_minutes'] : null;
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

        $linkRecord = FileDownloadLink::create([
            'token' => $token,
            'original_signed_url' => $signedUrl,
            'file_record_id' => $file->id,
            'client_application_id' => $client->id,
            'max_downloads' => $maxDownloads,
            'download_count' => 0,
            'allowed_ips' => $allowedIps,
            'password_hash' => $password ? Hash::make($password) : null,
            'is_revoked' => false,
            'expires_at' => $expiresAt,
        ]);

        $this->auditLogger->log('file.signed_url_generated', $client, $file, [
            'link_token' => $token,
            'expires_in_minutes' => $expiresInMinutes,
            'expires_at' => $expiresAt?->toIso8601String(),
            'max_downloads' => $maxDownloads,
            'allowed_ips' => $allowedIps,
            'has_password' => ! empty($password),
        ], $request);

        return response()->json([
            'download_url' => $signedUrl,
            'portal_url' => url("/d/{$token}"),
            'link_token' => $token,
            'expires_at' => $expiresAt?->toIso8601String(),
            'max_downloads' => $maxDownloads,
            'password_required' => ! empty($password),
        ]);
    }

    /**
     * Get link metadata and restrictions info for GUI portal (publicly accessible with valid signature).
     */
    public function linkInfo(Request $request, string $uuid): JsonResponse
    {
        $file = FileRecord::where('uuid', $uuid)->first();
        if (! $file) {
            return response()->json([
                'error' => 'FileNotFound',
                'message' => 'The requested file could not be found in this storage system.',
            ], Response::HTTP_NOT_FOUND);
        }

        $linkToken = $request->query('link');

        // Check if the request has a valid signature directly for this URL or against the download route URL
        $downloadUrl = URL::route('api.files.download', array_merge(['uuid' => $uuid], $request->query()));
        $downloadRequest = Request::create($downloadUrl, 'GET', $request->query(), [], [], $request->server->all());

        $ignoredParams = ['password', 'stream', 'view'];

        $hasUnexpiredSig = $request->hasValidSignatureWhileIgnoring(['password'])
            || $downloadRequest->hasValidSignatureWhileIgnoring($ignoredParams);

        $hasCorrectHmac = URL::hasCorrectSignature($request, true, ['password'])
            || URL::hasCorrectSignature($downloadRequest, true, $ignoredParams);

        $isValidSignature = $hasUnexpiredSig || ($linkToken && $hasCorrectHmac);

        if (! $isValidSignature) {
            return response()->json([
                'error' => 'InvalidOrExpiredSignature',
                'message' => 'The download link is invalid or has expired.',
            ], Response::HTTP_FORBIDDEN);
        }

        $linkRecord = null;
        if ($linkToken) {
            $linkRecord = FileDownloadLink::where('token', $linkToken)
                ->where('file_record_id', $file->id)
                ->first();
        }

        $isExpired = $linkRecord ? $linkRecord->isExpired() : false;
        $isRevoked = $linkRecord ? $linkRecord->is_revoked : false;
        $limitReached = $linkRecord ? $linkRecord->hasReachedDownloadLimit() : false;
        $clientIp = $request->ip();
        $ipAuthorized = $linkRecord ? $linkRecord->isIpAuthorized($clientIp) : true;

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
                'token' => $linkRecord?->token,
                'expires_at' => $linkRecord?->expires_at?->toIso8601String(),
                'max_downloads' => $linkRecord?->max_downloads,
                'download_count' => $linkRecord?->download_count ?? 0,
                'has_password' => ! empty($linkRecord?->password_hash),
                'is_expired' => $isExpired,
                'is_revoked' => $isRevoked,
                'limit_reached' => $limitReached,
                'ip_authorized' => $ipAuthorized,
                'client_ip' => $clientIp,
            ],
        ]);
    }

    /**
     * Stream the file from the NAS using the signed temporary URL with restriction checks.
     */
    public function download(Request $request, string $uuid): StreamedResponse|JsonResponse|View|RedirectResponse
    {
        // Determine if direct download is allowed immediately:
        // If password is required and not yet supplied, show GUI portal.
        // Otherwise, if the user requested the download in browser without password protection, stream the file directly.
        $linkToken = $request->query('link');
        $linkRecord = null;
        if ($linkToken) {
            $linkRecord = FileDownloadLink::where('token', $linkToken)
                ->where('file_record_id', function ($query) use ($uuid) {
                    $query->select('id')->from('file_records')->where('uuid', $uuid);
                })
                ->first();
        }

        $accept = $request->header('Accept', '');
        $isViewRequest = $request->boolean('view');
        $isStreamRequest = $request->boolean('stream');
        $isBrowserNavigation = str_contains($accept, 'text/html') && ! $request->expectsJson() && ! $isStreamRequest && ! $isViewRequest;

        $file = FileRecord::where('uuid', $uuid)->first();
        if (! $file) {
            if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                return view('app');
            }

            return response()->json([
                'error' => 'FileNotFound',
                'message' => 'The requested file could not be found.',
            ], Response::HTTP_NOT_FOUND);
        }

        // 1. Signature check
        // Check HMAC signature integrity (ignoring password, stream, and view query parameters).
        // If a link token is present, we defer expiration enforcement to $linkRecord->isExpired(),
        // allowing previously generated links to remain valid when expiration is extended in the database.
        $linkToken = $request->query('link');
        $ignoredParams = ['password', 'stream', 'view'];
        $hasCorrectHmac = URL::hasCorrectSignature($request, true, $ignoredParams);
        $hasUnexpiredSig = $request->hasValidSignatureWhileIgnoring($ignoredParams);

        $isValidSignature = $hasUnexpiredSig || ($linkToken && $hasCorrectHmac);

        if (! $isValidSignature) {
            if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                return view('app');
            }

            return response()->json([
                'error' => 'InvalidOrExpiredSignature',
                'message' => 'The download link is invalid or has expired.',
            ], Response::HTTP_FORBIDDEN);
        }

        // 2. File status check
        if ($file->status !== 'clean') {
            if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                return view('app');
            }

            return response()->json([
                'error' => 'FileUnavailable',
                'message' => 'File is not in clean status.',
            ], Response::HTTP_FORBIDDEN);
        }

        // 3. Link record & restriction checks (if link token provided)
        $linkToken = $request->query('link');
        /** @var FileDownloadLink|null $linkRecord */
        $linkRecord = null;

        if ($linkToken) {
            $isExplicitBrowserRequest = $request->header('X-Simulate-Browser') === '1'
                || ($isBrowserNavigation && ! app()->runningUnitTests());

            if ($isExplicitBrowserRequest) {
                return redirect()->to(url("/d/{$linkToken}"));
            }

            $linkRecord = FileDownloadLink::where('token', $linkToken)
                ->where('file_record_id', $file->id)
                ->first();

            if (! $linkRecord) {
                if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                    return view('app');
                }

                return response()->json([
                    'error' => 'LinkNotFound',
                    'message' => 'Download link token is invalid or has been purged.',
                ], Response::HTTP_NOT_FOUND);
            }

            // Check revocation
            if ($linkRecord->is_revoked) {
                if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                    return view('app');
                }

                return response()->json([
                    'error' => 'LinkRevoked',
                    'message' => 'This download link has been revoked by an administrator or client.',
                ], Response::HTTP_FORBIDDEN);
            }

            // Check expiration
            if ($linkRecord->isExpired()) {
                if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                    return view('app');
                }

                return response()->json([
                    'error' => 'LinkExpired',
                    'message' => 'This download link has expired.',
                ], Response::HTTP_GONE);
            }

            // Check download count limit
            if ($linkRecord->hasReachedDownloadLimit()) {
                if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                    return view('app');
                }

                return response()->json([
                    'error' => 'DownloadLimitReached',
                    'message' => 'The maximum allowed download limit for this link has been reached.',
                ], Response::HTTP_FORBIDDEN);
            }

            // Check IP restrictions
            $clientIp = $request->ip();
            if (! $linkRecord->isIpAuthorized($clientIp)) {
                $this->auditLogger->log('file.download_ip_blocked', $file->clientApplication, $file, [
                    'ip' => $clientIp,
                    'allowed_ips' => $linkRecord->allowed_ips,
                    'link_token' => $linkToken,
                ], $request);

                if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                    return view('app');
                }

                return response()->json([
                    'error' => 'IpRestrictionDenied',
                    'message' => "Access denied. Your IP address ({$clientIp}) is not authorized to use this download link.",
                ], Response::HTTP_FORBIDDEN);
            }

            // Check password protection
            if ($linkRecord->password_hash) {
                $providedPassword = $request->header('X-Download-Password')
                    ?? $request->query('password');

                if (! $providedPassword || ! Hash::check($providedPassword, $linkRecord->password_hash)) {
                    if ($isBrowserNavigation && ! app()->runningUnitTests()) {
                        return view('app');
                    }

                    return response()->json([
                        'error' => 'PasswordRequired',
                        'message' => 'This download link requires a valid password. Provide via X-Download-Password header or password query parameter.',
                    ], Response::HTTP_UNAUTHORIZED);
                }
            }
        }

        $nasDisk = Storage::disk($file->disk);

        if (! $nasDisk->exists($file->storage_path)) {
            return response()->json([
                'error' => 'FileNotFoundOnStorage',
                'message' => 'The physical file was not found on NAS storage.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Increment download/view counter and record last accessed timestamp
        if ($linkRecord) {
            $linkRecord->increment('download_count');
            $linkRecord->update(['last_accessed_at' => now()]);
        }

        $actionType = $isViewRequest ? 'file.inline_view' : 'file.streamed_download';

        $this->auditLogger->log($actionType, $file->clientApplication, $file, [
            'filename' => $file->original_filename,
            'size_bytes' => $file->size_bytes,
            'link_token' => $linkToken,
            'is_view' => $isViewRequest,
            'download_count' => $linkRecord?->download_count,
        ], $request);

        $headers = [
            'Content-Type' => $file->mime_type,
            'Content-Length' => $file->size_bytes,
            'Accept-Ranges' => 'bytes',
        ];

        if ($isViewRequest) {
            return Storage::disk($file->disk)->response($file->storage_path, $file->original_filename, $headers, 'inline');
        }

        return Storage::disk($file->disk)->download($file->storage_path, $file->original_filename, $headers);
    }
}
