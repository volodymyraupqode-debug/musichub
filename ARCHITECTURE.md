# MusicHub — Architecture

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval. Consistent with PROJECT_SPEC.md v0.2.
>
> **Changelog v0.2.4:** Sprint 1 reconciliation: SeaweedFS replaces MinIO for local S3 (ADR-0007); Compose `full` profile moved to Phase 4; PHP 8.4 via `php84` locally.
>
> **Changelog v0.2.3:** Q20/Q21: no Learning module or audio-analysis component in v1; extension points documented (Practice module, `practice-core` input-agnostic).
>
> **Changelog v0.2.2:** Q16: new Laravel module Practice and practice sync (§6a).
>
> **Changelog v0.2.1:** mobile is native-first per the Q11 guidance. `apps/mobile/score-view` (WebView, notation only) replaces `engine-web`. Native modules live in `apps/mobile/modules/*`. The editor is not ported to mobile.
>
> **Changelog v0.2:**
> - `apps/api` (Laravel) is excluded from the pnpm workspace. It is a pure Composer project, and Turborepo does not orchestrate it (§3.3).
> - New packages: `midi-engine` (MIDI devices, no alphaTab) and `practice-core` (practice logic). Shared runtime contracts (`PlaybackClock`, `NoteEvent`, `LiveNoteSource`) move into `music-model` so that consumers do not depend on alphaTab.
> - A generated MHD JSON Schema serves as the language-neutral contract.
> - The Node `music-worker` is deferred from Phase 4 to Phase 8 (mobile). Web import is client-side; the server stores the original file.
> - Sync: autosave cadence, revision kinds, single editing tab, client-supplied derived metadata.
> - Package naming compared with alternative proposals (§3.2).

## 1. Principles

1. **Modular monolith on the backend.** One Laravel API with internal modules plus queue workers from the same codebase. Web, mobile and API are separate applications, deployed independently. No microservices until a measured need exists.
2. **The music document is the product.** A versioned, platform-neutral JSON document (MusicHub Document, MHD; MUSIC_ENGINE.md §3) is the single source of truth. alphaTab is a rendering/playback/IO adapter, never the storage format.
3. **Pure core, thin shells.** Model, editing commands, timeline maths, practice evaluation and serialization are framework-free TypeScript. Web, the React Native JS runtime and Node can all use them; the mobile `ScoreView` WebView uses `music-engine`.
4. **The server does not understand music.** Laravel stores, versions, authorises and indexes documents. It validates the envelope (JSON Schema), size and limits, not musical semantics. Derived metadata (duration, track summary) is computed by the client with `music-model` and sent with the document.
5. **Contract first.** OpenAPI 3.1 is the API contract (`openapi/openapi.yaml`); the TS client is generated from it. The MHD JSON Schema is generated from the Zod schema.

## 2. Runtime overview

```
            ┌──────────────────────────────── Browser ─────────────────────────────────┐
            │ apps/web (Next.js, React)                                                 │
            │  ├─ UI shell + studio feature (React)  ── packages/ui, design-tokens      │
            │  ├─ editor-core (commands, undo/redo, selection) ◀──▶ music-model (MHD)   │
            │  ├─ music-engine ──▶ alphaTab (render worker + audio worklet)            │
            │  │      └─ PlaybackClock (audio-anchored)                                 │
            │  ├─ piano-visualizer (Canvas, own rAF loop) ◀── clock + timeline          │
            │  ├─ practice-core (wait mode, evaluation) ◀── midi-engine (Web MIDI)      │
            │  └─ IndexedDB drafts (+ Web Locks: one editing tab per composition)       │
            └───────────────┬───────────────────────────────────────────────────────────┘
                            │ HTTPS JSON /api/v1 (Sanctum SPA cookie)
 ┌────────────────────┐  ┌──▼──────────────────────────────┐   ┌──────────────┐
 │ apps/mobile (P8)   │─▶│ apps/api — Laravel 13 (Composer) │──▶│ PostgreSQL 18│
 │ RN UI + native mods │  │ Identity · Library · Documents · │   ├──────────────┤
 │ engine; bearer token│  │ Community · Moderation · Notif.  │──▶│ Redis        │ cache, queues, rate limits, sessions
 └────────────────────┘  └──┬───────────────────────────────┘──▶│ Object store │ S3 / SeaweedFS (dev): documents, uploads, avatars
                            │ Redis queues                       └──────────────┘
                    ┌───────▼──────────────────────────────┐
                    │ Laravel queue workers (Horizon):      │
                    │ emails, notifications, counters,      │
                    │ revision thinning, purge jobs         │
                    │ (P8) apps/music-worker (Node):        │
                    │ server-side import for mobile         │
                    └───────────────────────────────────────┘
```

`apps/music-worker` (Phase 8) consumes jobs that Laravel pushes to the Redis list `music-jobs` and reports back through an internal endpoint (API.md §9). It is a worker process with no database of its own. It runs alphaTab headless in Node: `ScoreLoader` works without a DOM per the alphaTab docs, and running the exporters in Node must be verified when the worker is built.

## 3. Monorepo layout

```
musichub/
├─ apps/
│  ├─ web/               Next.js 16 (App Router, Turbopack)                   [pnpm]
│  ├─ api/               Laravel 13 — standalone Composer project             [composer, NOT in pnpm workspace]
│  ├─ mobile/            Expo app (Phase 8; Q11 resolved: Expo)             [pnpm]
│  │   ├─ modules/       Expo native modules (midi, audio session; native audio if the prototype requires)
│  │   └─ score-view/    Vite build of music-engine (render/playback only) for the ScoreView WebView component
│  └─ music-worker/      Node worker for server-side import (Phase 8)        [pnpm]
├─ packages/
│  ├─ config/            Shared tsconfig, ESLint, Prettier, Vitest presets   (exists, T0.1)
│  ├─ music-model/       MHD types, Zod schema, JSON Schema export, migrations, invariants, IDs,
│  │                     tempo map, timeline (playback order, NoteEvent), shared contracts
│  │                     (PlaybackClock, LiveNoteSource), fixtures. Pure TS.
│  ├─ editor-core/       Commands + inverses, undo/redo, selection, caret, input mapping
│  │                     (tab, notation, piano-roll, MIDI step entry), fret assignment. Pure TS.
│  ├─ music-engine/      alphaTab adapter: import/export, MHD ⇄ Score, render controller,
│  │                     playback controller, audio-anchored clock, WebView bridge protocol.
│  │                     The ONLY package that imports alphaTab.
│  ├─ midi-engine/       MIDI device access (Web MIDI impl + interface for native impls),
│  │                     input normalisation (chords, sustain), MIDI-out scheduler. No alphaTab.
│  ├─ practice-core/     Practice session state machine (wait mode, loop, hands), performance
│  │                     evaluation (expected vs played, timing windows), scoring, session summaries.
│  │                     Pure TS, input-source agnostic. No courses/lessons in v1 (Q20).
│  ├─ piano-visualizer/  Keyboard geometry + culling (pure) and Canvas 2D painter. No React.
│  ├─ design-tokens/     Token source → CSS variables + TS.
│  ├─ ui/                Web design system: shadcn/ui components (owned source) + Tailwind v4 theme from tokens.
│  └─ api-client/        Generated TS client + types from OpenAPI.
├─ openapi/              openapi.yaml (API contract)
├─ docs/                 adr/, glossary.md, ops/
├─ infra/                docker-compose.yml, Dockerfiles, Caddy/nginx config
├─ spikes/               Throw-away Phase 0 experiments (never imported)
├─ *.md                  Root specification documents
└─ package.json, pnpm-workspace.yaml, turbo.json
```

### 3.1 Dependency rules (enforced by dependency-cruiser in CI from Sprint 1, plus the ESLint alphaTab import ban)

```
music-model        ← every TS package and app
editor-core        → music-model, zustand (vanilla only, no React)
music-engine       → music-model, @coderline/alphatab
midi-engine        → music-model
practice-core      → music-model
piano-visualizer   → music-model
ui                 → design-tokens
apps/web           → all packages above, api-client
apps/mobile        → music-model, practice-core, piano-visualizer (geometry), midi-engine (interfaces; native impl in apps/mobile/modules), design-tokens, api-client
apps/mobile/score-view → music-engine (+ piano-visualizer painter only if MOBILE.md option V1 is chosen)
apps/music-worker  → music-model, music-engine
```

- `music-model`, `editor-core`, `practice-core` and the geometry part of `piano-visualizer` run in Node without a DOM. They are unit-testable and usable in workers and in the React Native JS runtime.
- Packages never import apps; apps never import each other.
- Packages depend on interfaces from `music-model` (`PlaybackClock`, `LiveNoteSource`), not on each other's implementations. `apps/web` wires concrete implementations together.

### 3.2 Why this package split (comparison with alternative names)

An alternative split was proposed: `music-core`, `music-types`, `music-serialization`, `editor-ui`, `editor-commands`, `audio-engine`, `midi-engine`. Decision:

| Proposed | Decision | Reason |
|---|---|---|
| `music-types` + `music-core` + `music-serialization` | **Merged as `music-model`** with subpath exports (`/schema`, `/timeline`, `/migrations`) | Types, schema and migrations change together in every schema version. Separate packages would force lock-step releases with no consumer that needs only one part. Non-TS consumers (Laravel, a possible Swift app) use the generated JSON Schema. |
| `editor-commands` | **`editor-core`** (commands + undo + selection + input mapping) | Selection and input mapping are needed by every command; splitting them gains nothing. |
| `editor-ui` | **Not a package yet.** The studio UI lives in `apps/web/src/features/studio` | It has a single consumer. Mobile will not embed the web editor (MOBILE.md §2). Extract it only if a second web consumer appears. |
| `audio-engine` | **Part of `music-engine`** | In alphaTab, audio (alphaSynth) and rendering share the same API object, Score and MIDI generation. They cannot be separated without re-implementing either side. |
| `midi-engine` | **Adopted** | MIDI devices have nothing to do with alphaTab. The mobile platforms need native implementations behind the same interface. |
| — | **`practice-core` added** | Practice evaluation is a sizeable pure-logic domain (PIANO_VISUALIZER §6) shared by web and mobile. |
| `piano-visualizer`, `api-client` | Adopted as named | — |

### 3.3 Laravel and the JS toolchain

- `apps/api` has `composer.json` / `composer.lock` / `vendor/`. It must **not** have a pnpm-managed `package.json`. Laravel's default Vite/Tailwind frontend scaffold is removed because the API is API-only.
- `pnpm-workspace.yaml` must list `apps/web`, `apps/mobile`, `apps/music-worker` and `packages/*` explicitly, or use `!apps/api`. Done in Sprint 1 (S1-02): the workspace lists members explicitly.
- Turborepo orchestrates JS/TS only. PHP commands run through Composer scripts (`composer lint`, `composer test`) locally and in a separate CI job.
- Shared artefacts that cross the language boundary:
  - `openapi/openapi.yaml`: hand-written contract. Laravel feature tests check response shapes now and validate responses against it from Phase 4; TS codegen consumes it.
  - `packages/music-model/json-schema/mhd-v1.schema.json`: the full MHD v1 JSON Schema, generated from Zod (`createMhdJsonSchema()`) and kept in sync by a `music-model` test (file snapshot; `pnpm --filter @musichub/music-model test -u` regenerates it). Structure only; the invariants are runtime-only. From Phase 4 Laravel validates the envelope against a schema derived from it (`mhd-envelope.schema.json` in `apps/api/resources/schemas/`), and CI fails on drift.

### 3.4 Turborepo pipeline

Tasks `build`, `lint`, `typecheck`, `test`, `test:e2e`, `codegen` (OpenAPI → api-client). The MHD JSON Schema is produced by the `music-model` tests, not by `codegen` (§3.3). `codegen` inputs include `openapi/openapi.yaml`. The configuration already exists from T0.1 (`turbo.json`).

## 4. Web application (apps/web)

- **Rendering strategy:** marketing, community and public composition pages are Server Components (SEO). The studio (`/studio/...`) and the player on public pages are client-only islands. alphaTab is created only in the browser (`useEffect`) and destroyed with `api.destroy()`.
- **Per-frame work never goes through React.** The score cursor (alphaTab), the visualizer and the piano-roll playhead run their own `requestAnimationFrame` loops and read `PlaybackClock`. React state holds only coarse state (playing/paused, bar number at ≤ 10 Hz).
- **alphaTab under Turbopack (Next.js 16 default)**, per the alphaTab docs section "Next.js with Turbopack" (since 1.9.0):
  - Do **not** use `@coderline/alphatab-webpack`; Turbopack runs no webpack plugins.
  - `predev`/`prebuild` script copies `font/`, `soundfont/`, `alphaTab.mjs`, `alphaTab.core.mjs` from the package dist into `public/alphatab/` (git-ignored).
  - Settings: `core.scriptFile: '/alphatab/alphaTab.mjs'`, `core.fontDirectory: '/alphatab/font/'`, `player.soundFont: '/alphatab/soundfont/sonivox.sf2'` (prefix with `basePath` if used).
  - Cost: the worklet loads the unminified `alphaTab.core.mjs` (~2.5 MB). Serve it with long-lived immutable cache headers.
  - Whether rendering runs in a worker under Turbopack is not documented; verify in spike S1. Fallback: `next build --webpack` + `@coderline/alphatab-webpack`.
- **State:**
  - Server state: TanStack Query (generated client).
  - Studio/editor state: a **Zustand** store created in `editor-core` with `zustand/vanilla`, so it works without React in tests and in React Native. It holds the document, selection, undo/redo stacks and panel state. `apps/web` binds it with `useStore(store, selector)`. Every document mutation goes through `editor-core` commands; components never `set()` document data directly.
  - Per-frame playback data (clock time, active notes) is **not** stored in Zustand or React state (§4, second bullet).
  - Forms: React Hook Form + Zod resolver.
- **Local persistence:** IndexedDB stores the working document and the unsynced command log per composition. A Web Lock (`navigator.locks`) per composition allows one editing tab; other tabs open read-only.
- **Routes (initial):** `/` · `/explore` · `/c/[slug]` · `/u/[username]` · `/library` · `/studio/new` · `/studio/[compositionId]` · `/practice/[compositionId]` · `/settings` · `/auth/*`.

## 5. API application (apps/api)

Laravel modular structure (`app/Modules/<Module>/{Http,Models,Actions,Policies,Jobs,Events}`):

| Module | Responsibility |
|---|---|
| Identity | Registration, login, Sanctum (SPA cookie for web, bearer tokens for mobile), password reset, email verification, profile, avatar, blocks |
| Library | Composition metadata, folders, tags, search, trash |
| Documents | Revisions, blob storage, sync/conflicts, uploads (original files), import jobs (P8) |
| Community | Publishing, explore/feed, likes, comments, follows |
| Moderation | Reports, hide/remove, suspensions |
| Practice | Private practice sessions, progress, goals; idempotent batch upload; export/delete (API.md §7a). A future Learning module (courses/lessons, post‑v1, Q20) will reference practice data via `source`/`source_ref`; it is not created in v1 |
| Notifications | Database + email notifications |

Rules:
- Thin controllers → Action classes. Form Requests for validation, Policies for authorisation, API Resources for output (camelCase).
- Counters (likes, comments, followers) are denormalised and updated in the same transaction as the source row.
- The API never computes musical data. It reads `meta.title`/`meta.artist` from the document JSON and accepts client-computed `derived` metadata (API.md §5).

## 6. Cloud synchronization

**Model:** each composition has a linear revision history of full document snapshots.

1. Load: `GET /compositions/{id}/document` returns the document, the `revision` number and an `ETag`.
2. Edit locally. Every change is persisted to IndexedDB within ≤ 2 s (draft + command log). Undo/redo history is kept in memory and in the local command log; it is not synced.
3. Save: `PUT /compositions/{id}/document` with `If-Match: "<baseRevision>"` and body `{ document, derived, kind }`.
4. The server stores revision n+1 if head == base (`201`). Otherwise it returns `409 Conflict` with head metadata. A body identical to the head (same SHA‑256) returns `200` without a new revision.
5. On conflict the client offers *Reload theirs* · *Overwrite (`?force=true`)* · *Save mine as a copy*. No automatic merge in v1.
6. **Autosave to server:** after 30 s without changes, at most every 2 min during continuous editing, on explicit save (Ctrl/Cmd+S → `kind: manual`) and on page hide (`visibilitychange`, best effort). Offline: queue locally and retry with backoff. On reconnect, push with the stored base revision, so conflicts surface normally.
7. **Revision kinds:** `autosave`, `manual`, `restore`, `import`, `create`. Thinning job: keep all for 24 h; then one autosave per hour for 30 days; then one per day. `manual`, `restore`, `import`, `create` and named revisions are never thinned.
8. Snapshots are stored gzip-compressed in object storage. PostgreSQL keeps metadata and the SHA‑256.

Rationale: full snapshots are simple, debuggable and sufficient for single-author editing. Command-log or CRDT sync is a later option and requires an ADR.

## 6a. Practice data synchronization (Q16)

1. `practice-core` produces a `PracticeSession` summary when a session ends (or after 30 min of activity, or on page hide). The summary contains aggregates only: no audio and no MIDI event stream.
2. The client writes it to a local outbox: IndexedDB on web, SQLite on mobile. This works offline and before the user has an account. Local progress is computed from the outbox for instant display.
3. When signed in, online and `syncEnabled`, the outbox is flushed via `POST /me/practice/sessions:batch`, with retry and backoff. Client-generated UUIDv7 ids make this idempotent.
4. The server appends sessions and updates `practice_progress` in one transaction. Goals sync with last-write-wins plus tombstones; the resume position is last-write-wins.
5. On another device, the client fetches progress, goals and the resume position. The result is "practised on desktop yesterday, continue on the phone today".
6. Sync off: nothing is uploaded and local data stays. The user can separately delete server data (`DELETE /me/practice`) and export it (`GET /me/practice/export`).
7. Local sessions recorded before sign-in are offered for upload after the first sign-in (opt-in prompt).

## 7. Security

- Sanctum SPA auth (HttpOnly cookie + CSRF) for web: web and API must share a registrable domain (e.g. `app.example.com` + `api.example.com`) or `/api` is proxied through the web host (risk R19). Personal access tokens with abilities for mobile.
- Rate limits in Redis (API.md §10). Access levels guest / signed-in / verified email follow API.md §1.1, implemented as a `verified` middleware on content-creating routes plus Policies. Anti-spam rules follow API.md §10.1.
- Uploads: size limit (20 MB), extension + magic-byte check, stored as opaque blobs. In v1 the server never parses them; parsing happens client-side. From Phase 8 they are parsed only in `music-worker` with timeouts and memory limits.
- Private compositions are never exposed via public endpoints; policy tests cover every endpoint. `404` is returned for resources the caller may not see.
- Comments are plain text. No user HTML is rendered.
- Practice data is private (owner-only `/me/practice/*` endpoints, Policies) and is never joined into community queries.
- Secrets only via environment variables; `.env` is never committed.

## 8. Environments & deployment

| Env | Composition |
|---|---|
| Local | `infra/docker-compose.yml`: postgres 18 (host port 54320), redis 8, mailpit; SeaweedFS single node (S3 on 8333, ADR-0007) with an idempotent bucket bootstrap (`seaweedfs-init`). An optional `full` profile with `api` (php-fpm + Caddy) and `horizon` containers is deferred to Phase 4. Laravel runs on the host with PHP 8.4 (`php84` on Herd). Developers may run Laravel via Herd/`php artisan serve` instead. `pnpm dev` runs Next.js on the host. |
| CI | GitHub Actions. JS job: pnpm + turbo lint/typecheck/test/build. PHP job: Composer, Pint, Larastan, Pest with postgres + redis services. Later: Playwright e2e job. |
| Staging/Prod | Same images. Single host with Docker Compose or managed services (Q7). CDN for `/alphatab/*` and the SoundFont. Managed S3 in prod; SeaweedFS (Apache-2.0) only for local development and CI (ADR-0007). |

Observability: structured JSON logs, Sentry (web + api), basic metrics (queue depth, failed jobs, client-reported render/playback errors).

## 9. Architecture decision records

Record decisions and deviations as `docs/adr/NNNN-title.md` (context, decision, consequences). Initial ADRs (Sprint 1 task S1-13):

1. ADR‑0001 Modular monolith; Laravel as a standalone Composer project; Node worker only for music processing.
2. ADR‑0002 Own canonical document model (MHD) instead of alphaTab `Score`/JSON.
3. ADR‑0003 Snapshot revisions + optimistic concurrency for sync.
4. ADR‑0004 alphaTab integration under Turbopack (finalised after spike S1).
5. ADR‑0005 Mobile: Expo + React Native, native-first. WebView only for notation (`ScoreView`). Audio/visualizer placement is decided by the mobile prototype (MOBILE.md §6, ROADMAP Phase 2M).
