<?php

namespace App\Services\Scanner;

class ScanResult
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public bool $isClean,
        public ?string $threatName = null,
        public string $engine = 'unknown',
        public array $metadata = []
    ) {}

    public static function clean(string $engine, array $metadata = []): self
    {
        return new self(isClean: true, threatName: null, engine: $engine, metadata: $metadata);
    }

    public static function infected(string $threatName, string $engine, array $metadata = []): self
    {
        return new self(isClean: false, threatName: $threatName, engine: $engine, metadata: $metadata);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'is_clean' => $this->isClean,
            'threat_name' => $this->threatName,
            'engine' => $this->engine,
            'metadata' => $this->metadata,
        ];
    }
}
