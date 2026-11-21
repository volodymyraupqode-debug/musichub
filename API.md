# MusicHub — API Contracts

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval.
>
> **Changelog v0.2:**
> - Composition creation now takes a client-built document (the server does not build music from templates).
> - Document `PUT` uses a `{ document, derived, kind }` envelope.
> - Added `POST /uploads` for originals of client-side imports.
> - Server import endpoints moved to Phase 8.
> - Added user search, blocks, notifications and the email-verification gate.
> - Phase labels per endpoint group.
>
> **Changelog v0.2.3:** Q20/Q21: `source`, `sourceRef`, `inputSource` in practice payloads. No course or lesson endpoints in v1.
>
> **Changelog v0.2.2:** Q16 resolved. Added practice sync endpoints (§7a), personal data export, a practice row in the access matrix and a practice rate limit.
>
> **Changelog v0.2.1:** Q14 resolved. Added the access matrix (§1.1), the email-verification gate for content actions, anti-spam rules and new-account limits (§10).
>
> The machine-readable source of truth will be `openapi/openapi.yaml` (OpenAPI 3.1); this document defines the intended contract and must be kept in sync with it.
> Data shapes match DATABASE.md; document payloads match MUSIC_ENGINE.md §3.

## 1. General rules

- Base URL: `/api/v1`. Breaking changes → `/api/v2`. Additive changes allowed in v1.
- JSON, `camelCase` field names, UTF‑8. Timestamps ISO‑8601 UTC.
- IDs: UUID strings. Public lookups by `slug` / `username` also supported where stated.
- Auth:
  - Web: Sanctum SPA (cookie). `GET /sanctum/csrf-cookie` first; send `X-XSRF-TOKEN`.
  - Mobile: `Authorization: Bearer <token>` from `POST /auth/tokens`.
- Pagination: cursor-based. Response `{ "data": [...], "meta": { "nextCursor": "…" | null } }`; request `?cursor=…&limit=20` (max 50).
- Errors (RFC 9457 problem details style):

```json
{ "type": "validation_error", "title": "The given data was invalid.", "status": 422,
  "errors": { "title": ["The title field is required."] }, "requestId": "…" }
```

| Status | `type` |
|---|---|
| 400 | `bad_request` |
| 401 | `unauthenticated` |
| 403 | `forbidden` |
| 404 | `not_found` (also for private resources the caller cannot see) |
| 409 | `revision_conflict` |
| 412 | `precondition_failed` (missing `If-Match` on document write) |
| 413 | `payload_too_large` |
| 422 | `validation_error` / `unsupported_schema_version` / `invalid_document` |
| 403 | `email_unverified` (content actions, §1.1) |
| 429 | `rate_limited` (with `Retry-After`) |

### 1.1 Access matrix (Q14, resolved 2026‑11‑21)

| Action | Guest | Signed in (email not verified) | Verified email |
|---|---|---|---|
| Browse Community (explore, public composition pages, play) | ✅ | ✅ | ✅ |
| View profiles, followers, comments | ✅ | ✅ | ✅ |
| Register | ✅ (verification email sent; using the app does not wait for it) | — | — |
| Own library: create/edit/save private compositions, folders, tags, version history | ❌ | ✅ | ✅ |
| Like / unlike | ❌ 401 | ✅ | ✅ |
| Follow / unfollow | ❌ 401 | ✅ | ✅ |
| Report content, block users | ❌ 401 | ✅ | ✅ |
| Practice sync: sessions, progress, goals; export/delete practice data | ❌ 401 (stored locally only) | ✅ | ✅ |
| **Comment** (create/edit) | ❌ 401 | ❌ 403 `email_unverified` | ✅ |
| **Publish** (set visibility `public` or `unlisted`), fork (if Q5 allows) | ❌ 401 | ❌ 403 | ✅ |
| **Create posts** (only if text posts are introduced, Q17) | ❌ 401 | ❌ 403 | ✅ |
| **Upload files** (`POST /uploads`, `POST /imports`, `POST /me/avatar`) | ❌ 401 | ❌ 403 | ✅ |

Notes:
- Importing a file in the browser and editing it locally does not need an upload. Saving it to the cloud as an imported composition with its original (`sourceUploadId`) does need one.
- Email verification is **one** layer, not the only protection. See the anti-spam rules (§10), reports and blocks (§7–8) and moderation (§8).
- The client shows a "verify your email" prompt with a resend button (`POST /auth/email/verification-notification`) whenever a 403 `email_unverified` occurs.

## 2. Shared resource shapes

```ts
type UserSummary = { id: string; username: string; displayName: string; avatarUrl: string | null };

type UserProfile = UserSummary & {
  bio: string | null; followersCount: number; followingCount: number;
  publicCompositionsCount: number; isFollowedByMe: boolean; createdAt: string;
};

type CompositionSummary = {
  id: string; slug: string; title: string; artist: string | null;
  visibility: 'private' | 'unlisted' | 'public';
  owner: UserSummary;
  tracks: { name: string; instrumentFamily: string; hasTab: boolean; hasNotation: boolean }[];
  summary: { bars: number; durationMs: number; tempo: number; timeSignature: string; keySignature: string; trackCount: number };
  tags: string[]; difficulty: number | null;
  likesCount: number; commentsCount: number; playsCount: number;
  likedByMe: boolean; headRevision: number;
  publishedAt: string | null; createdAt: string; updatedAt: string;
};

type Composition = CompositionSummary & {
  description: string | null; license: string; folderId: string | null;
  forkedFrom: CompositionSummary | null; schemaVersion: number;
};

type Revision = { number: number; parentNumber: number | null; author: UserSummary | null;
  kind: 'create' | 'autosave' | 'manual' | 'restore' | 'import'; name: string | null; sizeBytes: number; schemaVersion: number; createdAt: string };
```

## 2a. System (Phase 0, Sprint 1)

| Method & path | Auth | Description |
|---|---|---|
| GET `/health` | – | `200 { status: 'ok', version, checks: { database: 'ok'\|'fail', redis: 'ok'\|'fail' } }`; `503` if a check fails. The first endpoint in `openapi.yaml`. |

## 3. Identity (Phase 4)

| Method & path | Auth | Description |
|---|---|---|
| POST `/auth/register` | – | `{ username, email, password, displayName }` → 201 `UserProfile` (+ session) |
| POST `/auth/login` | – | `{ email, password }` → 200 (session) |
| POST `/auth/logout` | user | 204 |
| POST `/auth/tokens` | – | Mobile: `{ email, password, deviceName }` → `{ token, user }` |
| DELETE `/auth/tokens/current` | bearer | revoke |
| POST `/auth/password/forgot` · `/auth/password/reset` | – | standard flow |
| POST `/auth/email/verification-notification` | user | resend |
| GET `/me` | user | `UserProfile & { email, emailVerified, settings }` |
| PATCH `/me` | user | `{ displayName?, bio?, locale?, settings? }` |
| POST `/me/avatar` | user | multipart `file` (png/jpg/webp ≤ 2 MB) |
| DELETE `/me` | user | account deletion (requires password); cascades practice data |
| POST `/me/data-export` | user | Phase 7: builds an archive of all personal data in a queue job, emails a time-limited link → `202` |

## 4. Library (owner-only, Phase 4)

| Method & path | Description |
|---|---|
| GET `/me/compositions?folderId=&q=&tag=&sort=updated\|title&cursor=` | Own compositions (all visibilities) |
| POST `/compositions` | `{ document: MhdDocument, derived: DerivedMeta, folderId?, sourceUploadId?, kind?: 'create'\|'import' }` → 201 `Composition` with revision 1. The client builds the document: from a template in `music-model`, or from an import done in the browser. |
| GET `/compositions/{id}` | Metadata. Owner, or anyone if public/unlisted |
| PATCH `/compositions/{id}` | `{ description?, visibility?, license?, folderId?, tags?, difficulty? }` (title/artist come from the document) |
| DELETE `/compositions/{id}` | Soft delete → trash |
| POST `/compositions/{id}/restore` | From trash |
| POST `/compositions/{id}/duplicate` | Copy as new private composition |
| GET/POST `/me/folders` · PATCH/DELETE `/me/folders/{id}` | Folder CRUD |

## 5. Documents & sync (Phase 4)

| Method & path | Description |
|---|---|
| GET `/compositions/{id}/document` | Head document. Response headers `ETag: "<revision>"`, `X-Schema-Version`. Body: MHD JSON (gzip transfer). `?revision=n` for a specific one (owner only). |
| PUT `/compositions/{id}/document` | **Requires** `If-Match: "<baseRevision>"`. Body `{ document: MhdDocument, derived: DerivedMeta, kind: 'autosave'\|'manual' }`; `Content-Encoding: gzip` accepted; limits 10 MB compressed, 50 MB decompressed. Optional header `X-Client-Id`. Query `?force=true` writes on top of the head despite a conflict. |
| GET `/compositions/{id}/revisions?cursor=` | `Revision[]` |
| PATCH `/compositions/{id}/revisions/{n}` | `{ name }` — name a version |
| POST `/compositions/{id}/revisions/{n}/restore` | Creates new head revision with content of `n` |

PUT responses:

| Case | Response |
|---|---|
| Saved | `201 { revision: Revision, composition: CompositionSummary }`, `ETag` new |
| Identical content (same sha256) | `200` with current head |
| Base ≠ head | `409 { type: 'revision_conflict', headRevision: Revision }` |
| Schema invalid / too new | `422 invalid_document` / `unsupported_schema_version` |

```ts
// Computed by music-model on the client; the server validates the shape only (ARCHITECTURE.md §1.4).
type DerivedMeta = {
  summary: { bars: number; durationMs: number; tempo: number; timeSignature: string; keySignature: string; trackCount: number };
  tracks: { position: number; name: string; instrumentFamily: string; midiProgram: number;
            hasTab: boolean; hasNotation: boolean; stringCount: number | null; tuning: string | null }[];
};
```

Server-side validation: JSON parse; envelope against the generated `mhd-envelope.schema.json` (`format === 'musichub'`, supported `schemaVersion`, required top-level keys); `DerivedMeta` shape; size limits; count limits (≤ 64 tracks, ≤ 5000 bars, `derived.tracks.length === document.tracks.length`). Musical semantics are validated client-side by `music-model`; from Phase 8 also by `music-worker`. `meta.title` (required, 1–200 chars) and `meta.artist` are copied into `compositions`.

## 6. Uploads, import & export

**Web flow (Phase 4):**
1. The browser parses the file with alphaTab and builds the MHD document plus `ImportWarning[]`.
2. `POST /uploads` stores the original file.
3. `POST /compositions` is sent with `kind: 'import'` and `sourceUploadId`.

| Method & path | Phase | Description |
|---|---|---|
| POST `/uploads` | 4 | multipart `file` (≤ 20 MB), `purpose: 'import_source'` → `201 { id, detectedFormat, sizeBytes }`. Stored as an opaque blob; the server does not parse it. |
| GET `/compositions/{id}/original` | 4 | Download the original uploaded file (owner) |
| POST `/imports` | 8 | Server-side import for mobile: `{ uploadId, folderId? }` → `202 { importJob }` |
| GET `/imports/{id}` | 8 | `{ id, status, compositionId, warnings: ImportWarning[], errorCode }`. The client polls every 1–2 s. |

**Export is client-side only** in v1 (MHD, GP7, alphaTex, MIDI, WAV; MUSIC_ENGINE.md §4.3). There is no export endpoint.

`ImportWarning = { code: string; message: string; location?: { trackIndex?: number; barIndex?: number } }` — e.g. `unsupported_effect`, `lyrics_dropped`, `automation_simplified`.

## 7. Community (Phase 6)

Authorization per action follows §1.1. Comments and publishing require a verified email (otherwise `403 { type: 'email_unverified' }`); likes, follows, reports and blocks require sign-in only.

| Method & path | Auth | Description |
|---|---|---|
| GET `/explore?sort=latest\|popular&instrument=&tag=&q=&cursor=` | optional | Public compositions |
| GET `/feed?cursor=` | user | Compositions from followed users |
| GET `/c/{slug}` | optional | Public/unlisted composition by slug → `Composition` |
| GET `/c/{slug}/document` | optional | Head document of public/unlisted composition |
| POST `/compositions/{id}/plays` | optional | Increment play counter (rate-limited, buffered) → 204 |
| PUT `/compositions/{id}/like` · DELETE same | user | Idempotent like/unlike → `{ likesCount, likedByMe }` |
| GET `/compositions/{id}/comments?cursor=` | optional | Top-level comments, each with up to 3 latest replies and `repliesCount` (from `comments.replies_count`) |
| GET `/comments/{id}/replies?cursor=` | optional | |
| POST `/compositions/{id}/comments` | user | `{ body, parentId?, anchor? }` |
| PATCH `/comments/{id}` · DELETE `/comments/{id}` | author / moderator | |
| GET `/users/{username}` | optional | `UserProfile` |
| GET `/users/{username}/compositions?cursor=` | optional | Public compositions |
| GET `/users/{username}/followers` · `/following` | optional | `UserSummary[]` |
| PUT `/users/{username}/follow` · DELETE same | user | Idempotent |
| POST `/compositions/{id}/fork` | user | Only if forks are approved (PROJECT_SPEC Q5) |
| GET `/tags?q=` | – | Autocomplete |
| GET `/users?q=&cursor=` | optional | User search (username/display name, trigram) → `UserSummary[]` |
| PUT `/users/{username}/block` · DELETE same | user | Block/unblock (DATABASE.md §3.10a) |
| GET `/me/blocks` | user | Blocked users |
| GET `/me/notifications?cursor=` | user | `{ id, type: 'follow'\|'like'\|'comment'\|'reply', actor: UserSummary, compositionId?, commentId?, readAt, createdAt }[]` |
| POST `/me/notifications/read` | user | `{ ids?: string[] }`; marks all as read if omitted |

## 7a. Practice (Phase 4; data collected locally from Phase 2)

Practice data is **private to the owner**. These endpoints exist only under `/me`; no public or community endpoint returns practice data. Clients store sessions locally first (IndexedDB / SQLite) and upload when online and sync is enabled.

```ts
type PracticeSession = {               // DATABASE.md §3.15; aggregates only, no audio, no MIDI streams
  id: string;                           // client UUIDv7, idempotency key
  compositionId: string | null; compositionRevision: number | null; compositionTitle: string;
  instrument: 'piano' | 'guitar' | 'bass' | 'drums' | 'other';
  mode: 'listen' | 'play_along' | 'wait'; hands: 'both' | 'left' | 'right' | null;
  source: 'free_practice'; sourceRef: null;               // v1 values; reserved for post‑v1 lessons (Q20)
  inputSource: 'none' | 'midi_keyboard' | 'midi_guitar' | 'other_midi'; // 'midi_guitar' only if spike S8 is approved (Q21)
  range: { startBar: number; endBar: number } | null;
  startedAt: string; endedAt: string; activeMs: number; attempts: number;
  speedRatio: number; bpmAchieved: number | null;
  notes: { expected: number; correct: number; missed: number; extra: number; wrong: number } | null;
  accuracy: number | null; timing: { meanMs: number; stdMs: number } | null;
  completed: boolean; device: 'web' | 'ios' | 'android'; clientVersion: string;
};
type PracticeProgress = { compositionId: string; totalActiveMs: number; sessionsCount: number; attemptsCount: number;
  bestAccuracy: number | null; bestBpm: number | null; bestTimingStdMs: number | null;
  sections: { startBar: number; endBar: number; hands: string | null; bestAccuracy: number | null; bestBpm: number | null; completedAt: string | null }[];
  resumePosition: { bar: number; hands: string | null; mode: string; speedRatio: number } | null; lastPracticedAt: string };
type PracticeGoal = { id: string; compositionId: string | null;
  type: 'daily_minutes' | 'weekly_minutes' | 'target_bpm' | 'target_accuracy' | 'complete_fragment'; source: 'user';
  target: Record<string, number>; status: 'active' | 'achieved' | 'archived'; achievedAt: string | null;
  updatedAt: string; deletedAt: string | null };
```

| Method & path | Description |
|---|---|
| GET `/me/practice/settings` · PATCH same | `{ syncEnabled: boolean }` (`users.practice_sync_enabled`) |
| POST `/me/practice/sessions:batch` | `{ sessions: PracticeSession[] }` (≤ 100). Idempotent by `id`: already-known ids are skipped. → `200 { accepted: string[], skipped: string[], rejected: { id, reason }[] }`. Updates `practice_progress` in the same transaction. If sync is disabled → `409 { type: 'practice_sync_disabled' }`. |
| GET `/me/practice/sessions?compositionId=&from=&to=&cursor=` | History |
| GET `/me/practice/progress?compositionId=` | One `PracticeProgress`, or all compositions (paginated) without the parameter |
| PUT `/me/practice/progress/{compositionId}/resume` | `{ bar, hands, mode, speedRatio }`: "continue where I stopped" across devices (last write wins) |
| GET `/me/practice/goals?updatedSince=` | Goals incl. tombstones since a timestamp (delta sync) |
| PUT `/me/practice/goals/{id}` | Upsert (client UUIDv7). Last-write-wins by `updatedAt`; an older `updatedAt` than stored → `409` with the stored goal |
| DELETE `/me/practice/goals/{id}` | Soft delete (tombstone) |
| GET `/me/practice/stats?period=week\|month\|all` | `{ activeMs, sessions, streakDays, averageAccuracy, compositionsPractised }` |
| GET `/me/practice/export` | All practice data as JSON (download) |
| DELETE `/me/practice` | Deletes all server-side practice data (sessions, progress, goals); requires password confirmation. Local data is not affected. |

**Offline & sync rules:**
- Sessions are append-only and idempotent, so retries are safe.
- Goals use last-write-wins with tombstones.
- Progress is server-derived: clients show local progress immediately and replace it with the server value after sync.
- With sync disabled, the client keeps everything locally and never calls the upload endpoints.

## 8. Moderation (Phase 6)

| Method & path | Auth | Description |
|---|---|---|
| POST `/reports` | user | `{ subjectType: 'composition'\|'comment'\|'user', subjectId, reason: 'copyright'\|'spam'\|'abuse'\|'other', details? }` |
| GET `/admin/reports?status=open` | moderator | |
| POST `/admin/reports/{id}/resolve` | moderator | `{ action: 'dismiss'\|'hide'\|'remove'\|'suspend_user', note }` |

Copyright takedown requests also accepted via a public form (email workflow) — ToS required before Community launch (PROJECT_SPEC R14).

## 9. Internal (music-worker ↔ API, Phase 8)

Not public; protected by shared HMAC secret, network-restricted.

| Method & path | Description |
|---|---|
| POST `/internal/import-jobs/{id}/result` (Phase 8) | `{ status, documentStorageKey?, summary?, tracks?, warnings?, errorCode? }` — API creates composition + revision 1 |

Job envelope pushed to Redis `music-jobs`: `{ "type": "import", "jobId", "uploadStorageKey", "detectedFormat", "userId" }`.

## 10. Rate limits (initial)

| Scope | Limit |
|---|---|
| auth (login/register/forgot) | 10 / min / IP |
| document PUT | 60 / min / user |
| imports | 20 / hour / user |
| comments | 10 / min / user |
| likes / follows | 60 / min / user |
| plays | 1 / composition / 30 s / client |
| uploads | 30 / hour / user |
| reports | 20 / day / user |
| publish (visibility → public) | 10 / day / user |
| practice uploads (`sessions:batch`) | 60 / hour / user |

### 10.1 Anti-spam rules (Phase 6 unless noted)

- **New-account limits:** accounts younger than 24 h have comments limited to 3 / 10 min, publishing limited to 2 / day, and links blocked in comments. Values are configurable in `config/community.php`.
- **Content checks on comments:** max 2 links; identical-comment detection (same author, same body within 10 min → 422); a basic banned-terms list is configurable by moderators.
- **Registration:** an invisible honeypot field plus the auth rate limit (§10). A CAPTCHA provider is **not** added by default; it is open question Q19.
- **Reports:** a composition or comment reported by ≥ 3 distinct verified users is auto-hidden (`moderation_state = 'hidden'`) until a moderator reviews it (threshold configurable). Copyright reports go straight to the moderator queue.
- **Blocks:** enforced in all community queries (DATABASE.md §3.10a).
- **Moderation:** admin queue, hide/remove, suspend user (§8). Suspended users get `403 { type: 'account_suspended' }` on all write endpoints.
