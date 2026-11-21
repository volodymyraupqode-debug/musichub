<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

/** Shape of the `Health` schema in openapi/openapi.yaml. */
function assertHealthContract(array $json): void
{
    expect(array_keys($json))->toEqualCanonicalizing(['status', 'version', 'checks'])
        ->and($json['status'])->toBeIn(['ok', 'fail'])
        ->and($json['version'])->toBeString()
        ->and(array_keys($json['checks']))->toEqualCanonicalizing(['database', 'redis'])
        ->and($json['checks']['database'])->toBeIn(['ok', 'fail'])
        ->and($json['checks']['redis'])->toBeIn(['ok', 'fail']);
}

it('reports ok when PostgreSQL and Redis are reachable', function () {
    $response = $this->getJson('/api/v1/health');

    $response->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertExactJson([
            'status' => 'ok',
            'version' => config('app.version'),
            'checks' => ['database' => 'ok', 'redis' => 'ok'],
        ]);
    assertHealthContract($response->json());
});

it('reports 503 when Redis is unreachable', function () {
    config()->set('database.redis.default.port', 1);
    Redis::purge('default');

    $response = $this->getJson('/api/v1/health');

    $response->assertStatus(503)->assertJsonPath('status', 'fail')
        ->assertJsonPath('checks.redis', 'fail')
        ->assertJsonPath('checks.database', 'ok');
    assertHealthContract($response->json());
});

it('reports 503 when the database is unreachable', function () {
    config()->set('database.connections.pgsql.port', 1);
    DB::purge('pgsql');

    $response = $this->getJson('/api/v1/health');

    $response->assertStatus(503)->assertJsonPath('status', 'fail')
        ->assertJsonPath('checks.database', 'fail')
        ->assertJsonPath('checks.redis', 'ok');
    assertHealthContract($response->json());
});
