<?php

declare(strict_types=1);

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/*
 * Integration test against the real S3-compatible storage (SeaweedFS, ADR-0007).
 * Never replaced by Storage::fake(). Fails loudly when the storage is unreachable.
 * Only touches the object it creates.
 */

function s3Disk(): Filesystem
{
    /** @var array<string, mixed> $config */
    $config = config('filesystems.disks.s3');

    // throw => true: every S3 error surfaces as an exception instead of returning false.
    return Storage::build([...$config, 'throw' => true]);
}

beforeEach(function () {
    $this->objectKey = 'tests/pest-'.Str::uuid7().'.txt';

    $endpoint = (string) config('filesystems.disks.s3.endpoint');
    try {
        Http::timeout(3)->get(rtrim($endpoint, '/').'/healthz')->throw();
    } catch (Throwable $e) {
        throw new RuntimeException(
            "S3 storage is not reachable at {$endpoint}. Start it with `docker compose -f infra/docker-compose.yml up -d --wait`. ({$e->getMessage()})",
            previous: $e,
        );
    }
});

afterEach(function () {
    // Clean up our own object even if an assertion failed.
    try {
        s3Disk()->delete($this->objectKey);
    } catch (Throwable) {
        // Storage unreachable: nothing to clean up.
    }
});

it('stores, reads and deletes an object through the S3 API', function () {
    $disk = s3Disk();
    $content = 'musichub s3 integration '.Str::random(32);

    expect($disk->put($this->objectKey, $content))->toBeTrue()
        ->and($disk->exists($this->objectKey))->toBeTrue()
        ->and($disk->get($this->objectKey))->toBe($content);

    expect($disk->delete($this->objectKey))->toBeTrue()
        ->and($disk->exists($this->objectKey))->toBeFalse();
});

it('serves a presigned temporary URL (path-style, SigV4)', function () {
    $disk = s3Disk();
    $content = 'presigned '.Str::random(16);
    $disk->put($this->objectKey, $content);

    $url = $disk->temporaryUrl($this->objectKey, now()->addMinutes(5));

    expect($url)->toContain('/'.config('filesystems.disks.s3.bucket').'/')
        ->and(Http::get($url)->throw()->body())->toBe($content);
});
