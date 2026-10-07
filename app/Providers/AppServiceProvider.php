<?php

namespace App\Providers;

use App\Services\Scanner\ClamAvScanner;
use App\Services\Scanner\MockScanner;
use App\Services\Scanner\ScannerInterface;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(ScannerInterface::class, function () {
            $driver = env('SCANNER_DRIVER', 'mock');
            if ($driver === 'clamav') {
                return new ClamAvScanner(
                    host: env('CLAMAV_HOST', '127.0.0.1'),
                    port: (int) env('CLAMAV_PORT', 3310),
                    timeout: (int) env('CLAMAV_TIMEOUT', 30)
                );
            }

            return new MockScanner;
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);
    }
}
