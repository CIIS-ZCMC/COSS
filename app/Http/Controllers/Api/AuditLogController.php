<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ClientApplication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Retrieve audit trail for the authenticated client application.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var ClientApplication $client */
        $client = $request->attributes->get('client_app');

        $perPage = min((int) ($request->input('per_page') ?? 25), 100);

        $logs = AuditLog::where('client_application_id', $client->id)
            ->latest('created_at')
            ->paginate($perPage);

        return response()->json($logs);
    }
}
