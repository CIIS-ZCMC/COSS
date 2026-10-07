<?php

namespace App\Jobs;

use App\Models\ClientApplication;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DispatchClientWebhookJob implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public ClientApplication $clientApp,
        public string $event,
        public array $payload
    ) {}

    public function handle(): void
    {
        if (empty($this->clientApp->webhook_url)) {
            return;
        }

        $data = [
            'event' => $this->event,
            'timestamp' => now()->toIso8601String(),
            'payload' => $this->payload,
        ];

        $jsonPayload = json_encode($data, JSON_THROW_ON_ERROR);

        $headers = [
            'Content-Type' => 'application/json',
            'User-Agent' => 'COSS-Webhook/1.0',
        ];

        // Sign with HMAC SHA256 if webhook_secret is configured
        if (! empty($this->clientApp->webhook_secret)) {
            $headers['X-COSS-Signature'] = hash_hmac('sha256', $jsonPayload, $this->clientApp->webhook_secret);
        }

        try {
            Http::timeout(10)
                ->withHeaders($headers)
                ->withBody($jsonPayload, 'application/json')
                ->post($this->clientApp->webhook_url);
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch webhook to client {$this->clientApp->uuid}: {$e->getMessage()}");
        }
    }
}
