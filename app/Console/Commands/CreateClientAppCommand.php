<?php

namespace App\Console\Commands;

use App\Models\ClientApplication;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CreateClientAppCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'coss:client:create 
                            {name : Name of the client application}
                            {--webhook-url= : Webhook URL for scan completion callbacks}
                            {--allowed-ips= : Comma-separated list of allowed IPs}
                            {--rate-limit=120 : Rate limit per minute}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Register a new client application and generate API Key and Secret';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $name = (string) $this->argument('name');
        $webhookUrl = $this->option('webhook-url');
        $allowedIpsRaw = $this->option('allowed-ips');
        $rateLimit = (int) $this->option('rate-limit');

        $allowedIps = null;
        if (! empty($allowedIpsRaw)) {
            $allowedIps = array_map('trim', explode(',', (string) $allowedIpsRaw));
        }

        $apiKey = 'coss_live_'.Str::random(32);
        $plainSecret = Str::random(48);
        $secretHash = Hash::make($plainSecret);
        $webhookSecret = ! empty($webhookUrl) ? Str::random(32) : null;

        $client = ClientApplication::create([
            'name' => $name,
            'api_key' => $apiKey,
            'api_secret_hash' => $secretHash,
            'allowed_ips' => $allowedIps,
            'webhook_url' => $webhookUrl,
            'webhook_secret' => $webhookSecret,
            'is_active' => true,
            'rate_limit_per_minute' => $rateLimit,
        ]);

        $this->newLine();
        $this->info("Client Application [{$client->name}] registered successfully!");
        $this->table(
            ['Property', 'Value'],
            [
                ['UUID', $client->uuid],
                ['Name', $client->name],
                ['API Key (X-API-Key)', $apiKey],
                ['API Secret (X-API-Secret)', $plainSecret],
                ['Allowed IPs', $allowedIps ? implode(', ', $allowedIps) : 'Any (unrestricted)'],
                ['Webhook URL', $webhookUrl ?: 'None'],
                ['Webhook HMAC Secret', $webhookSecret ?: 'None'],
                ['Rate Limit', "{$rateLimit} req/min"],
            ]
        );

        $this->warn('IMPORTANT: Store the API Secret safely. It is hashed in the database and cannot be retrieved again.');
        $this->newLine();

        return Command::SUCCESS;
    }
}
