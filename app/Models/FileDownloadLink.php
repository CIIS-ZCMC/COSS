<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class FileDownloadLink extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'token',
        'original_signed_url',
        'file_record_id',
        'client_application_id',
        'max_downloads',
        'download_count',
        'allowed_ips',
        'password_hash',
        'is_revoked',
        'expires_at',
        'last_accessed_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'max_downloads' => 'integer',
        'download_count' => 'integer',
        'allowed_ips' => 'array',
        'is_revoked' => 'boolean',
        'expires_at' => 'datetime',
        'last_accessed_at' => 'datetime',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password_hash',
    ];

    protected static function booted(): void
    {
        static::creating(function (FileDownloadLink $model): void {
            if (empty($model->token)) {
                $model->token = (string) Str::uuid();
            }
        });
    }

    /**
     * @return BelongsTo<FileRecord, $this>
     */
    public function fileRecord(): BelongsTo
    {
        return $this->belongsTo(FileRecord::class);
    }

    /**
     * @return BelongsTo<ClientApplication, $this>
     */
    public function clientApplication(): BelongsTo
    {
        return $this->belongsTo(ClientApplication::class);
    }

    /**
     * Check if the download link is currently expired.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Check if the download link has reached its maximum download limit.
     */
    public function hasReachedDownloadLimit(): bool
    {
        return $this->max_downloads !== null && $this->download_count >= $this->max_downloads;
    }

    /**
     * Check if a given IP address is authorized.
     */
    public function isIpAuthorized(?string $ip): bool
    {
        if (empty($this->allowed_ips)) {
            return true;
        }

        if (empty($ip)) {
            return false;
        }

        return in_array($ip, $this->allowed_ips, true);
    }
}
