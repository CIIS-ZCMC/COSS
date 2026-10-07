<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileChunk extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'upload_id',
        'client_application_id',
        'chunk_number',
        'total_chunks',
        'chunk_size_bytes',
        'temp_path',
        'status',
        'expires_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'chunk_number' => 'integer',
        'total_chunks' => 'integer',
        'chunk_size_bytes' => 'integer',
        'expires_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<ClientApplication, $this>
     */
    public function clientApplication(): BelongsTo
    {
        return $this->belongsTo(ClientApplication::class);
    }
}
