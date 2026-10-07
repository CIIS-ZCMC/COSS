<?php

namespace App\Services\Scanner;

class MockScanner implements ScannerInterface
{
    /**
     * Standard EICAR test string signature.
     */
    public const EICAR_SIGNATURE = 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

    public function scan(string $absoluteFilePath): ScanResult
    {
        $normalizedPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $absoluteFilePath);

        $handle = @fopen($normalizedPath, 'rb');
        if (! $handle) {
            return ScanResult::infected('UNREADABLE_FILE', 'mock');
        }

        $contents = fread($handle, 4096);
        fclose($handle);

        // Check for EICAR standard signature or test keyword
        if (str_contains($contents, self::EICAR_SIGNATURE) || str_contains($contents, '__INFECTED_PAYLOAD_TEST__')) {
            return ScanResult::infected('EICAR-Test-Signature', 'mock', [
                'file_size' => filesize($absoluteFilePath),
                'timestamp' => now()->toISOString(),
            ]);
        }

        return ScanResult::clean('mock', [
            'file_size' => filesize($absoluteFilePath),
            'timestamp' => now()->toISOString(),
        ]);
    }
}
