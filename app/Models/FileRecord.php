<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class FileRecord extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'client_application_id',
        'original_filename',
        'stored_filename',
        'mime_type',
        'size_bytes',
        'sha256_checksum',
        'disk',
        'storage_path',
        'status',
        'scan_result',
        'retention_days',
        'purge_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'size_bytes' => 'integer',
        'scan_result' => 'array',
        'retention_days' => 'integer',
        'purge_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (FileRecord $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return BelongsTo<ClientApplication, $this>
     */
    public function clientApplication(): BelongsTo
    {
        return $this->belongsTo(ClientApplication::class);
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
}
