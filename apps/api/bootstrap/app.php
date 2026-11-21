<?php

declare(strict_types=1);

use App\Http\Problems\ProblemDetailsRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API-only application: every error is a problem-details JSON response.
        $exceptions->render(
            fn (Throwable $e, Request $request) => ProblemDetailsRenderer::render($e, $request),
        );
    })->create();
