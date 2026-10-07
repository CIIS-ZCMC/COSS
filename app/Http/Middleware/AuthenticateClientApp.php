<?php

namespace App\Http\Middleware;

use App\Models\ClientApplication;
use App\Services\AuditLoggerService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateClientApp
{
    public function __construct(
        protected AuditLoggerService $auditLogger
    ) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $apiKey = $request->header('COSS-API-Key')
            ?? $request->header('coss-api-key')
            ?? $request->header('X-API-Key')
            ?? $request->header('x-api-key');

        $apiSecret = $request->header('COSS-API-Secret')
            ?? $request->header('coss-api-secret')
            ?? $request->header('X-API-Secret')
            ?? $request->header('x-api-secret');

        // Check fallback for Bearer token: "Bearer api_key:api_secret"
        if (! $apiKey && $request->bearerToken()) {
            $parts = explode(':', $request->bearerToken(), 2);
            $apiKey = $parts[0] ?? null;
            $apiSecret = $parts[1] ?? null;
        }

        if (! $apiKey || ! $apiSecret) {
            $this->auditLogger->log('auth.failed', null, null, [
                'reason' => 'Missing credentials',
                'path' => $request->path(),
            ], $request);

            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'Missing COSS-API-Key and COSS-API-Secret credentials.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $client = ClientApplication::where('api_key', $apiKey)->first();

        if (! $client || ! Hash::check($apiSecret, $client->api_secret_hash)) {
            $this->auditLogger->log('auth.failed', null, null, [
                'reason' => 'Invalid credentials',
                'api_key' => $apiKey,
                'path' => $request->path(),
            ], $request);

            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'Invalid API credentials.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (! $client->is_active) {
            $this->auditLogger->log('auth.blocked', $client, null, [
                'reason' => 'Client account disabled',
            ], $request);

            return response()->json([
                'error' => 'Forbidden',
                'message' => 'Client application is deactivated.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Validate IP allowlisting if configured
        if (! empty($client->allowed_ips)) {
            $clientIp = $request->ip();
            if (! in_array($clientIp, $client->allowed_ips, true)) {
                $this->auditLogger->log('auth.ip_rejected', $client, null, [
                    'ip' => $clientIp,
                    'allowed' => $client->allowed_ips,
                ], $request);

                return response()->json([
                    'error' => 'Forbidden',
                    'message' => 'IP address not allowed.',
                ], Response::HTTP_FORBIDDEN);
            }
        }

        // Attach client application to request attributes for multi-tenant isolation
        $request->attributes->set('client_app', $client);

        return $next($request);
    }
}
