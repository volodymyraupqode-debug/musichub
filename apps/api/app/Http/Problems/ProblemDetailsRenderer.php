<?php

declare(strict_types=1);

namespace App\Http\Problems;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Renders API errors as RFC 9457 problem details (API.md §1, openapi `ProblemDetails`).
 */
final class ProblemDetailsRenderer
{
    private const TYPES = [
        400 => 'bad_request',
        401 => 'unauthenticated',
        403 => 'forbidden',
        404 => 'not_found',
        405 => 'method_not_allowed',
        409 => 'conflict',
        412 => 'precondition_failed',
        413 => 'payload_too_large',
        422 => 'validation_error',
        429 => 'rate_limited',
        503 => 'service_unavailable',
    ];

    public static function render(Throwable $e, Request $request): JsonResponse
    {
        [$status, $title, $headers] = self::classify($e);

        $body = [
            'type' => self::TYPES[$status] ?? ($status >= 500 ? 'internal_error' : 'http_error'),
            'title' => $title,
            'status' => $status,
            'requestId' => self::requestId($request),
        ];

        if ($e instanceof ValidationException) {
            $body['errors'] = $e->errors();
        }

        if ($status >= 500 && config('app.debug')) {
            $body['detail'] = $e->getMessage();
        }

        return new JsonResponse($body, $status, ['Content-Type' => 'application/problem+json'] + $headers);
    }

    /**
     * @return array{0: int, 1: string, 2: array<string, string>}
     */
    private static function classify(Throwable $e): array
    {
        return match (true) {
            $e instanceof ValidationException => [422, 'The given data was invalid.', []],
            $e instanceof AuthenticationException => [401, 'Unauthenticated.', []],
            $e instanceof AuthorizationException => [403, 'This action is unauthorized.', []],
            $e instanceof ModelNotFoundException => [404, 'Resource not found.', []],
            $e instanceof ThrottleRequestsException => [429, 'Too many requests.', self::stringHeaders($e->getHeaders())],
            $e instanceof HttpExceptionInterface => [
                $e->getStatusCode(),
                self::httpTitle($e),
                self::stringHeaders($e->getHeaders()),
            ],
            default => [500, 'Internal server error.', []],
        };
    }

    private static function httpTitle(HttpExceptionInterface $e): string
    {
        return match ($e->getStatusCode()) {
            404 => 'Resource not found.',
            405 => 'Method not allowed.',
            default => $e->getMessage() !== '' ? $e->getMessage() : 'HTTP error.',
        };
    }

    /**
     * @param  array<array-key, mixed>  $headers
     * @return array<string, string>
     */
    private static function stringHeaders(array $headers): array
    {
        $result = [];
        foreach ($headers as $name => $value) {
            if (is_string($name) && is_scalar($value)) {
                $result[$name] = (string) $value;
            }
        }

        return $result;
    }

    private static function requestId(Request $request): string
    {
        $header = $request->headers->get('X-Request-Id');

        return is_string($header) && $header !== '' ? $header : (string) Str::uuid7();
    }
}
