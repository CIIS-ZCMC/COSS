<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ClientApplication extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'name',
        'api_key',
        'api_secret_hash',
        'allowed_ips',
        'webhook_url',
        'webhook_secret',
        'is_active',
        'rate_limit_per_minute',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'allowed_ips' => 'array',
        'is_active' => 'boolean',
        'rate_limit_per_minute' => 'integer',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'api_secret_hash',
        'webhook_secret',
    ];

    protected static function booted(): void
    {
        static::creating(function (ClientApplication $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return HasMany<FileRecord, $this>
     */
    public function files(): HasMany
    {
        return $this->hasMany(FileRecord::class);
    }

    /**
     * @return HasMany<AuditLog, $this>
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    /**
     * @return HasMany<FileDownloadLink, $this>
     */
    public function downloadLinks(): HasMany
    {
        return $this->hasMany(FileDownloadLink::class);
    }

    /**
     * Get filesystem-friendly folder name based on system name.
     */
    public function getStorageFolder(): string
    {
        $slug = Str::slug($this->name);

        return ! empty($slug) ? $slug : $this->uuid;
    }
}
