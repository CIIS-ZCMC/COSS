<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\ClientApplication;
use App\Models\FileRecord;
use Illuminate\Http\Request;

class AuditLoggerService
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function log(
        string $event,
        ?ClientApplication $client = null,
        ?FileRecord $file = null,
        array $payload = [],
        ?Request $request = null
    ): AuditLog {
        $ip = $request?->ip() ?? request()->ip() ?? '127.0.0.1';
        $userAgent = $request?->userAgent() ?? request()->userAgent() ?? 'System/CLI';

        return AuditLog::create([
            'client_application_id' => $client?->id,
            'file_record_id' => $file?->id,
            'event' => $event,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'payload' => $payload,
        ]);
    }
}
