<?php

declare(strict_types=1);

use App\Http\Problems\ProblemDetailsRenderer;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

it('maps 429 to rate_limited and keeps Retry-After', function () {
    $response = ProblemDetailsRenderer::render(new TooManyRequestsHttpException(30), Request::create('/api/v1/x'));

    expect($response->getStatusCode())->toBe(429)
        ->and($response->headers->get('Retry-After'))->toBe('30')
        ->and($response->getData(true)['type'])->toBe('rate_limited');
});
