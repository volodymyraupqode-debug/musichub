# MusicHub — Database Design

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval. PostgreSQL 18. Consistent with ARCHITECTURE.md §5–6 and API.md v0.2.
>
> **Changelog v0.2:**
> - Added the `user_blocks` table, required by MOBILE/App Store rules and referenced by Moderation.
> - Added `comments.replies_count`, which the API needs.
> - Added `composition_revisions.kind` and `size_uncompressed`.
> - Added `uploads.purpose`.
> - Added the required extensions (§1.1) and user search indexes.
> - `summary` and the track rows now come from client-computed `derived` data (the server does not compute music).
> - `import_jobs` is used from Phase 8 only.
>
> **Changelog v0.2.2:** Q20/Q21: forward-compatible practice columns `source`, `source_ref`, `input_source`. No course tables in v1.
>
> **Changelog v0.2.1:** Q16 resolved: practice results are stored server-side. New tables `practice_sessions`, `practice_progress`, `practice_goals` (§3.15–3.17); `users.practice_sync_enabled`; data export/deletion lifecycle (§5).

## 1. Conventions

- Primary keys: `uuid` (UUIDv7, time-ordered, safe to expose). Column `id`. Generated in the app (Laravel `Str::uuid7()`); PostgreSQL 18's native `uuidv7()` may be used as the column default.
- Public URLs use `slug` (compositions) / `username` (users), never sequential ids.
- Timestamps: `timestamptz`, `created_at`, `updated_at`; soft delete `deleted_at` where noted.
- Enums: `text` + `CHECK` constraint (easier migrations than PG enums).
- Money/ordering-sensitive counters: `integer NOT NULL DEFAULT 0`, updated transactionally.
- **Music documents are NOT stored in PostgreSQL.** Only metadata + object-storage key + hash (ARCHITECTURE.md §6). A small denormalised `summary jsonb` is kept for search/listing.
- All FKs indexed. `ON DELETE` behaviour stated per FK.
- Laravel migrations are the only way to change schema.

### 1.1 Extensions

`citext` (case-insensitive usernames, emails, slugs, tags) and `pg_trgm` (fuzzy search). Both are created in the first migration.

## 2. Entity overview

```
users ─┬─< compositions ─┬─< composition_revisions
       │                 ├─< composition_tracks        (searchable summary of tracks)
       │                 ├─< composition_tag >─ tags
       │                 ├─< likes >─ users
       │                 ├─< comments >─ users (threaded, 1 level)
       │                 └─  folder (folders)
       ├─< folders
       ├─< follows (follower → followee)
       ├─< user_blocks (blocker → blocked)
       ├─< uploads ─── import_jobs
       ├─< reports
       ├─< practice_sessions ─── (composition, nullable)
       ├─< practice_progress  (one row per user × composition)
       ├─< practice_goals
       └─< personal_access_tokens / sessions / notifications (Laravel standard)
```

## 3. Tables

### 3.1 users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| username | citext UNIQUE NOT NULL | 3–30 chars `[a-z0-9_]`, immutable-ish (rename allowed 1×/30 days) |
| email | citext UNIQUE NOT NULL | |
| email_verified_at | timestamptz NULL | required for comments, publishing, posts and uploads (API.md §1.1) |
| password | text NULL | NULL for social-only accounts |
| display_name | text NOT NULL | |
| bio | text NULL | ≤ 500 chars |
| avatar_key | text NULL | object-storage key |
| locale | text NOT NULL DEFAULT 'en' | |
| role | text NOT NULL DEFAULT 'user' | CHECK in (user, moderator, admin) |
| status | text NOT NULL DEFAULT 'active' | CHECK in (active, suspended, deleted) |
| followers_count, following_count, public_compositions_count | integer DEFAULT 0 | denormalised |
| practice_sync_enabled | boolean NOT NULL DEFAULT true | user can turn practice sync off (API.md §7a); when false, the server rejects practice uploads with `409 practice_sync_disabled` |
| settings | jsonb NOT NULL DEFAULT '{}' | UI prefs (theme, visualizer calibration offset, default instrument…) |
| created_at, updated_at, deleted_at | timestamptz | soft delete; GDPR erasure job anonymises |

Indexes: GIN `pg_trgm` on `username` and `display_name` (user search, API `GET /users?q=`).

### 3.2 social_accounts (Phase 6, optional)
`id`, `user_id → users ON DELETE CASCADE`, `provider` (google, apple), `provider_user_id`, UNIQUE(provider, provider_user_id).

### 3.3 folders
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users CASCADE | |
| parent_id | uuid FK folders CASCADE NULL | max depth 3 (app-enforced) |
| name | text NOT NULL | UNIQUE(user_id, parent_id, name) |
| position | integer | manual ordering |

### 3.4 compositions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK users CASCADE | |
| folder_id | uuid FK folders SET NULL | |
| slug | citext UNIQUE NOT NULL | generated from title + short id at creation; stays stable when the title changes (old links keep working) |
| title | text NOT NULL | mirrored from `document.meta.title` on save |
| artist | text NULL | |
| description | text NULL | ≤ 2000 |
| visibility | text NOT NULL DEFAULT 'private' | CHECK in (private, unlisted, public) |
| license | text NOT NULL DEFAULT 'all_rights_reserved' | CHECK list; options per PROJECT_SPEC Q6 |
| head_revision_id | uuid FK composition_revisions NULL | |
| head_revision_number | integer NOT NULL DEFAULT 0 | used for `If-Match` |
| schema_version | integer NOT NULL | MHD schema version of head |
| summary | jsonb NOT NULL DEFAULT '{}' | `{ bars, durationMs, tempo, timeSignature, keySignature, trackCount }`. Taken from the client's `derived` payload on save, computed by `music-model`; the server only validates its shape |
| difficulty | smallint NULL | 1–5, user-provided |
| forked_from_id | uuid FK compositions SET NULL | only if forks are approved (PROJECT_SPEC Q5) |
| source_upload_id | uuid FK uploads SET NULL | original imported file |
| likes_count, comments_count, plays_count | integer DEFAULT 0 | |
| published_at | timestamptz NULL | first time visibility became public |
| moderation_state | text NOT NULL DEFAULT 'ok' | CHECK in (ok, hidden, removed) |
| search_vector | tsvector GENERATED | title (A), artist (B), description (C); GIN index |
| created_at, updated_at, deleted_at | timestamptz | soft delete → trash for 30 days |

Indexes: `(owner_id, updated_at DESC)`, `(visibility, published_at DESC) WHERE visibility='public' AND moderation_state='ok' AND deleted_at IS NULL`, `(likes_count DESC)` partial same predicate, GIN(`search_vector`), `pg_trgm` GIN on `title`.

### 3.5 composition_revisions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| composition_id | uuid FK compositions CASCADE | |
| number | integer NOT NULL | UNIQUE(composition_id, number), monotonically +1 |
| parent_number | integer NULL | base revision the client edited |
| kind | text NOT NULL | CHECK in (create, autosave, manual, restore, import); drives thinning (ARCHITECTURE.md §6.7) |
| author_id | uuid FK users SET NULL | |
| schema_version | integer NOT NULL | |
| storage_key | text NOT NULL | `documents/{composition_id}/{number}.mhd.json.gz` |
| sha256 | char(64) NOT NULL | dedupe / integrity |
| size_bytes | integer NOT NULL | compressed size; max 10 MB |
| size_uncompressed | integer NOT NULL | max 50 MB |
| name | text NULL | user-named version (never pruned) |
| client_id | text NULL | device/session id that produced it |
| created_at | timestamptz | |

### 3.6 composition_tracks
Denormalised per head revision, rewritten on each save from the client's `derived.tracks`. Used for search and filters ("songs with bass tab", "piano").
`id`, `composition_id FK CASCADE`, `position smallint`, `name text`, `instrument_family text` (guitar, bass, piano, drums, vocals, strings, other), `midi_program smallint`, `has_tab bool`, `has_notation bool`, `string_count smallint NULL`, `tuning text NULL` (e.g. `E2 A2 D3 G3 B3 E4`). Index `(instrument_family)`.

### 3.7 tags / composition_tag
`tags(id uuid, name citext UNIQUE, slug citext UNIQUE, usage_count int)`; `composition_tag(composition_id FK CASCADE, tag_id FK CASCADE, PK(composition_id, tag_id))`. Max 10 tags per composition.

### 3.8 likes
`user_id FK CASCADE`, `composition_id FK CASCADE`, `created_at`, PK(user_id, composition_id), index (composition_id, created_at DESC).

### 3.9 comments
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| composition_id | uuid FK CASCADE | |
| author_id | uuid FK users SET NULL | |
| parent_id | uuid FK comments CASCADE NULL | one level of replies only |
| replies_count | integer NOT NULL DEFAULT 0 | denormalised, top-level comments only |
| body | text NOT NULL | plain text, 1–2000 chars |
| anchor | jsonb NULL | optional musical anchor `{ revision, barIndex, trackId? }` (bar-level comments, Phase 6+) |
| edited_at, deleted_at | timestamptz NULL | deleted → body hidden, thread kept |
| moderation_state | text DEFAULT 'ok' | |
| created_at | timestamptz | index (composition_id, created_at) |

### 3.10 follows
`follower_id FK users CASCADE`, `followee_id FK users CASCADE`, `created_at`, PK(follower_id, followee_id), CHECK(follower_id <> followee_id), index (followee_id).

### 3.10a user_blocks
`blocker_id FK users CASCADE`, `blocked_id FK users CASCADE`, `created_at`, PK(blocker_id, blocked_id), CHECK(blocker_id <> blocked_id), index (blocked_id). Effects: the blocked user cannot comment on, like or follow the blocker's content, and existing follows are removed. Each side's comments are hidden for the other in API responses.

### 3.11 uploads
`id`, `user_id FK CASCADE`, `purpose` (CHECK in `import_source`), `original_filename`, `storage_key`, `mime`, `detected_format` (gp3, gp4, gp5, gpx, gp, musicxml, mxl, capx, alphatex, mhd), `size_bytes`, `sha256`, `created_at`. Originals retained (R3 mitigation) for 90 days or while referenced by a composition.

### 3.12 import_jobs (Phase 8 — server-side import for mobile)
`id`, `upload_id FK CASCADE`, `user_id FK CASCADE`, `status` (queued, processing, succeeded, failed), `composition_id FK SET NULL` (result), `warnings jsonb` (lossy-conversion notes), `error_code text NULL`, `attempts smallint`, `started_at`, `finished_at`, `created_at`.

### 3.13 reports
`id`, `reporter_id FK users SET NULL`, `subject_type` (composition, comment, user), `subject_id uuid`, `reason` (copyright, spam, abuse, other), `details text`, `status` (open, actioned, dismissed), `handled_by FK users NULL`, `handled_at`, `created_at`. Index (status, created_at).

### 3.14 Laravel standard tables
`personal_access_tokens` (Sanctum, mobile), `sessions` (if DB driver; default Redis), `password_reset_tokens`, `notifications`, `jobs`/`failed_jobs` (Horizon uses Redis; failed jobs in DB), `cache` not used (Redis).

### 3.15 practice_sessions (Phase 4; collected locally from Phase 2)

Aggregated results of one practice session. **No raw audio and no MIDI event streams are stored** (only aggregates and metadata).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | **client-generated UUIDv7**, which makes offline uploads idempotent (`ON CONFLICT DO NOTHING`) |
| user_id | uuid FK users CASCADE | |
| composition_id | uuid FK compositions SET NULL NULL | NULL for local-only files or deleted compositions |
| composition_revision | integer NULL | revision practised |
| composition_title | text NOT NULL | snapshot, so history stays readable if the composition is deleted |
| instrument | text NOT NULL | CHECK in (piano, guitar, bass, drums, other) |
| mode | text NOT NULL | CHECK in (listen, play_along, wait) |
| source | text NOT NULL DEFAULT 'free_practice' | what started the session. v1 allows only `free_practice`; reserved for the post‑v1 learning system (e.g. `lesson`, `exercise`), extended by migration |
| source_ref | uuid NULL | v1 always NULL; later references the lesson/exercise without changing existing rows |
| input_source | text NOT NULL | CHECK in (none, midi_keyboard, midi_guitar, other_midi). How correctness was measured; `none` = no checking (listen, guitar without MIDI). `midi_guitar` is accepted only if S8 is approved; reserved for a future `microphone` value |
| hands | text NULL | CHECK in (both, left, right) |
| range_start_bar, range_end_bar | integer NULL | practised fragment (loop), 0-based bar indexes |
| started_at, ended_at | timestamptz NOT NULL | |
| active_ms | integer NOT NULL | practice time excluding pauses |
| attempts | integer NOT NULL DEFAULT 1 | loop passes |
| speed_ratio | numeric(4,3) NOT NULL | playback speed, 0.25–2.0 |
| bpm_achieved | numeric(6,2) NULL | score tempo × speed at the fragment |
| notes_expected, notes_correct, notes_missed, notes_extra, notes_wrong | integer NULL | NULL when `input_source = 'none'` |
| accuracy | numeric(5,4) NULL | notes_correct / notes_expected |
| timing_mean_ms, timing_std_ms | numeric(7,2) NULL | rhythm accuracy |
| completed | boolean NOT NULL DEFAULT false | the fragment met the session's completion criteria (§3.17 goal or default: accuracy ≥ 0.9 in wait/play-along) |
| device | text NOT NULL | CHECK in (web, ios, android) |
| client_version | text NOT NULL | |
| created_at | timestamptz | server receive time |

Indexes: `(user_id, started_at DESC)`, `(user_id, composition_id, started_at DESC)`.

### 3.16 practice_progress

Server-maintained aggregate per user × composition, updated in the same transaction as session inserts (plain arithmetic, no musical logic).

| Column | Type | Notes |
|---|---|---|
| user_id | uuid FK users CASCADE | PK part |
| composition_id | uuid FK compositions CASCADE | PK part |
| total_active_ms | bigint NOT NULL DEFAULT 0 | |
| sessions_count, attempts_count | integer NOT NULL DEFAULT 0 | |
| best_accuracy | numeric(5,4) NULL | |
| best_bpm | numeric(6,2) NULL | |
| best_timing_std_ms | numeric(7,2) NULL | |
| sections | jsonb NOT NULL DEFAULT '[]' | per practised fragment: `{ startBar, endBar, hands, bestAccuracy, bestBpm, completedAt }` (max 200 entries) |
| resume_position | jsonb NULL | `{ bar, hands, mode, speedRatio }`: where to continue on any device |
| last_practiced_at | timestamptz | |

### 3.17 practice_goals

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | client-generated UUIDv7 (offline creation) |
| user_id | uuid FK users CASCADE | |
| composition_id | uuid FK compositions CASCADE NULL | NULL for general goals |
| type | text NOT NULL | CHECK in (daily_minutes, weekly_minutes, target_bpm, target_accuracy, complete_fragment) |
| source, source_ref | text NOT NULL DEFAULT 'user' / uuid NULL | v1: `user`-created goals only; reserved for goals assigned by future lessons |
| target | jsonb NOT NULL | e.g. `{ minutes: 20 }`, `{ bpm: 120, startBar: 4, endBar: 12 }`, `{ accuracy: 0.95 }` |
| status | text NOT NULL DEFAULT 'active' | CHECK in (active, achieved, archived) |
| achieved_at | timestamptz NULL | |
| updated_at | timestamptz NOT NULL | last-write-wins sync key |
| deleted_at | timestamptz NULL | tombstone for sync |

**Courses and lessons are not part of v1** (Q20, resolved). "Completed" in v1 means **completed fragments and achieved goals** (`practice_progress.sections[].completedAt`, `practice_goals.status = achieved`).

Forward compatibility for the post‑v1 learning system (designed separately):
- Sessions and goals already carry `source` / `source_ref`, so a future lesson can reference them without rewriting history.
- A fragment is identified by `composition_id` + bar range + hands, which a future lesson can also use.
- Future course/module/lesson tables are added alongside; existing practice tables need only CHECK-list extensions.

## 4. Feed queries

- **Explore / latest:** public compositions by `published_at DESC`, keyset pagination on `(published_at, id)`.
- **Popular:** `likes_count DESC` over a time window (materialised view `popular_compositions_7d` refreshed every 10 min by scheduler) — introduce only when needed.
- **Following feed:** `compositions WHERE owner_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)` + keyset. Fan-out-on-read; fine until large scale.

## 5. Data lifecycle

- Composition delete → soft delete (trash, 30 days) → hard delete job removes revisions + blobs.
- User deletion → status `deleted`, profile anonymised, private compositions purged, public ones removed or anonymised (PROJECT_SPEC Q15), comments shown as "deleted user".
- Revision thinning job (ARCHITECTURE.md §6.7).
- **Practice data** is private to its owner: it is never exposed via public or community endpoints and never used for rankings in v1. Users can export it (`GET /me/practice/export`) and delete it (`DELETE /me/practice`) at any time; account deletion cascades. Turning sync off does not delete server data; the user is offered a separate "delete synced practice data" action.
- **Personal data export** (all account data: profile, compositions metadata, documents, comments, practice): `POST /me/data-export` builds an archive in a queue job and emails a time-limited download link (Phase 7).

## 6. Redis usage (not persistent truth)

| Key space | Use |
|---|---|
| `cache:*` | API response/profile caches, tag lists |
| `rl:*` | rate limiting |
| `session:*` | web sessions |
| `queues:*` | Laravel queues (Horizon) |
| `music-jobs` | jobs for the Node music-worker (Phase 8) |
| `plays:{compositionId}` | play counter buffer, flushed to PG every minute |
