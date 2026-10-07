<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'client_application_id',
        'file_record_id',
        'event',
        'ip_address',
        'user_agent',
        'payload',
        'created_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'payload' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (AuditLog $model): void {
            if (empty($model->created_at)) {
                $model->created_at = now();
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
     * @return BelongsTo<FileRecord, $this>
     */
    public function fileRecord(): BelongsTo
    {
        return $this->belongsTo(FileRecord::class);
    }
}
