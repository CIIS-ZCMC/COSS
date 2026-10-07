<?php

namespace App\Services\Scanner;

use Exception;

class ClamAvScanner implements ScannerInterface
{
    public function __construct(
        protected string $host = '127.0.0.1',
        protected int $port = 3310,
        protected int $timeout = 30
    ) {}

    public function scan(string $absoluteFilePath): ScanResult
    {
        if (! file_exists($absoluteFilePath)) {
            return ScanResult::infected('FILE_NOT_FOUND', 'clamav');
        }

        try {
            $socket = @fsockopen($this->host, $this->port, $errorCode, $errorMessage, (float) $this->timeout);

            if (! $socket) {
                throw new Exception("Unable to connect to ClamAV daemon: {$errorMessage} ({$errorCode})");
            }

            // Stream file to ClamAV via INSTREAM command
            fwrite($socket, "zINSTREAM\0");

            $handle = fopen($absoluteFilePath, 'rb');
            if ($handle === false) {
                fclose($socket);
                throw new Exception("Unable to open file for ClamAV scanning: {$absoluteFilePath}");
            }

            while (! feof($handle)) {
                $chunk = fread($handle, 8192);
                $length = strlen($chunk);
                if ($length > 0) {
                    fwrite($socket, pack('N', $length));
                    fwrite($socket, $chunk);
                }
            }
            fclose($handle);

            // Send zero-length chunk to mark EOF
            fwrite($socket, pack('N', 0));

            $response = trim((string) fgets($socket));
            fclose($socket);

            // Response formats:
            // "stream: OK"
            // "stream: Win.Test.EICAR_HDB-1 FOUND"
            if (str_ends_with($response, 'OK')) {
                return ScanResult::clean('clamav', ['raw_response' => $response]);
            }

            if (preg_match('/stream:\s+(.+)\s+FOUND/i', $response, $matches)) {
                return ScanResult::infected($matches[1], 'clamav', ['raw_response' => $response]);
            }

            return ScanResult::clean('clamav', ['raw_response' => $response]);
        } catch (\Throwable $e) {
            return ScanResult::infected('SCAN_ENGINE_FAILURE: '.$e->getMessage(), 'clamav');
        }
    }
}
