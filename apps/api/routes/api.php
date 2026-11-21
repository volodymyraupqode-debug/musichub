<?php

declare(strict_types=1);

use App\Modules\System\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

// All routes in this file are served under /api/v1 (bootstrap/app.php).

Route::get('/health', HealthController::class)->name('health');
