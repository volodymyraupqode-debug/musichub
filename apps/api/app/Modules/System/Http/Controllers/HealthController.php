<?php

declare(strict_types=1);

namespace App\Modules\System\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * GET /api/v1/health — contract: openapi/openapi.yaml `getHealth`, API.md §2a.
 */
final class HealthController
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->check(static fn (): mixed => DB::connection()->select('select 1')),
            'redis' => $this->check(static fn (): mixed => Redis::connection()->ping()),
        ];

        $healthy = ! in_array('fail', $checks, true);

        return response()->json(
            [
                'status' => $healthy ? 'ok' : 'fail',
                'version' => (string) config('app.version'),
                'checks' => $checks,
            ],
            $healthy ? 200 : 503,
            ['Cache-Control' => 'no-store'],
        );
    }

    /**
     * @param  callable(): mixed  $probe
     * @return 'ok'|'fail'
     */
    private function check(callable $probe): string
    {
        try {
            $probe();

            return 'ok';
        } catch (Throwable $e) {
            report($e);

            return 'fail';
        }
    }
}
