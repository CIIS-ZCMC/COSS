<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ManagementController;
use App\Http\Controllers\PortalDownloadController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// Public Short Portal Routes (/d/{token})
Route::get('/d/{token}', [PortalDownloadController::class, 'show'])->name('portal.download');
Route::get('/d/{token}/info', [PortalDownloadController::class, 'info'])->name('portal.download.info');

// Auth Routes (Session / Web)
Route::prefix('api/auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});

// Management API Routes (Protected by Auth)
Route::prefix('api/management')->middleware('auth')->group(function () {
    Route::get('/stats', [ManagementController::class, 'stats']);

    // User Management
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // Connected Systems
    Route::get('/systems', [ManagementController::class, 'getSystems']);
    Route::post('/systems', [ManagementController::class, 'storeSystem']);
    Route::put('/systems/{id}', [ManagementController::class, 'updateSystem']);
    Route::delete('/systems/{id}', [ManagementController::class, 'deleteSystem']);
    Route::post('/systems/{id}/regenerate-secret', [ManagementController::class, 'regenerateSecret']);

    // Quarantined and Expired files
    Route::get('/files', [ManagementController::class, 'getQuarantineAndExpiredFiles']);
    Route::post('/files/{uuid}/restore', [ManagementController::class, 'restoreFile']);
    Route::post('/files/{uuid}/release', [ManagementController::class, 'releaseQuarantine']);
    Route::delete('/files/{uuid}/purge', [ManagementController::class, 'purgeFilePermanently']);
    Route::post('/files/purge-expired', [ManagementController::class, 'purgeAllExpired']);

    // Link Restrictions & Download Links Management
    Route::get('/links', [ManagementController::class, 'getDownloadLinks']);
    Route::post('/links', [ManagementController::class, 'createDownloadLink']);
    Route::put('/links/{token}', [ManagementController::class, 'updateDownloadLink']);
    Route::post('/links/{token}/revoke-toggle', [ManagementController::class, 'toggleRevokeDownloadLink']);
    Route::post('/links/purge-expired', [ManagementController::class, 'purgeExpiredDownloadLinks']);
});

// Single Page Application catch-all to load React management dashboard
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
