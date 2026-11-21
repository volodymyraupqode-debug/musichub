<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Extensions required by the schema (DATABASE.md §1.1):
 * citext for case-insensitive usernames/emails/slugs/tags, pg_trgm for fuzzy search.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS citext');
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    }

    public function down(): void
    {
        DB::statement('DROP EXTENSION IF EXISTS pg_trgm');
        DB::statement('DROP EXTENSION IF EXISTS citext');
    }
};
