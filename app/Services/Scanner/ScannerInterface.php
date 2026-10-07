<?php

namespace App\Services\Scanner;

interface ScannerInterface
{
    /**
     * Scan an absolute file path and return the result.
     */
    public function scan(string $absoluteFilePath): ScanResult;
}
