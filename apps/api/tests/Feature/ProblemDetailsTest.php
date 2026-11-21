<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

it('renders unknown API routes as a problem-details 404', function () {
    $this->getJson('/api/v1/does-not-exist', ['X-Request-Id' => 'req-123'])
        ->assertNotFound()
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertExactJson([
            'type' => 'not_found',
            'title' => 'Resource not found.',
            'status' => 404,
            'requestId' => 'req-123',
        ]);
});

it('renders validation errors as a problem-details 422', function () {
    Route::post('/api/v1/__test/validate', fn (Request $request) => $request->validate(['title' => 'required']));

    $this->postJson('/api/v1/__test/validate', [])
        ->assertUnprocessable()
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('type', 'validation_error')
        ->assertJsonPath('status', 422)
        ->assertJsonStructure(['type', 'title', 'status', 'requestId', 'errors' => ['title']]);
});

it('hides internal error details when debug is off', function () {
    config()->set('app.debug', false);
    Route::get('/api/v1/__test/boom', fn () => throw new RuntimeException('secret internals'));

    $response = $this->getJson('/api/v1/__test/boom');

    $response->assertStatus(500)->assertJsonPath('type', 'internal_error');
    expect($response->json())->not->toHaveKey('detail');
});
