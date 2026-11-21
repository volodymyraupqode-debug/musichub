<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('enables the citext and pg_trgm extensions', function () {
    $extensions = collect(DB::select('select extname from pg_extension'))->pluck('extname');

    expect($extensions)->toContain('citext', 'pg_trgm');
});
