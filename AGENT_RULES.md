# MusicHub — Rules for AI Agents

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval. Changelog v0.2: package list updated (midi-engine, practice-core); Laravel/Composer rule; clock rule; Prettier chosen; spike rules. Applies to every AI coding agent (and humans) working in this repository. AGENTS.md is the short entry point; this file is the full rulebook. If a rule conflicts with a user instruction in the current task, follow the user and mention the conflict.

## 1. Before you start a task

1. Read AGENTS.md, then the documents relevant to the task (see table in §9).
2. Identify the roadmap phase (ROADMAP.md). Do not implement features of a later phase unless the task says so.
3. If the task requires a decision not covered by the docs (new dependency, schema change, new endpoint, architectural change) — **stop and ask**, or propose an ADR in `docs/adr/`.
4. Restate the acceptance criteria in your plan; keep scope to exactly that.

## 2. Source of truth & consistency

- Root `*.md` specs are authoritative. Code must match them; if code must differ, update the spec **in the same change** and say so.
- `openapi/openapi.yaml` is the API contract; API.md must agree with it. Change the contract first, regenerate `packages/api-client`, then implement.
- The MHD schema (`packages/music-model`) is the document contract; MUSIC_ENGINE.md §3 must agree with it.
- Never leave two documents contradicting each other.

## 3. Architecture rules

- Modular monolith. Do **not** introduce new services, message brokers, databases or deployment units without an approved ADR.
- Respect package boundaries (ARCHITECTURE.md §3.1):
  - `music-model`, `editor-core`, `practice-core`: pure TS, no DOM, no React, no alphaTab, no I/O.
  - Only `music-engine` imports `@coderline/alphatab`.
  - `midi-engine` owns device access (Web MIDI / native); nothing else calls `navigator.requestMIDIAccess`.
  - `piano-visualizer` is framework-agnostic (no React).
  - Shared interfaces (`PlaybackClock`, `LiveNoteSource`, `NoteEvent`) live in `music-model/contracts`; depend on them, not on implementations.
  - Apps never import other apps.
- `apps/api` is a standalone Composer project: no pnpm `package.json`, no Laravel Vite/Tailwind scaffold, not part of Turborepo. PHP tooling runs through Composer scripts.
- Mobile (`apps/mobile`): React Native screens + shared TS packages + Expo native modules. A WebView is allowed only for the `ScoreView` notation component; any other WebView use needs an ADR. Never embed the web studio/editor in mobile.
- Animation and timing: anything that moves with playback reads `PlaybackClock.now()` inside its own `requestAnimationFrame` loop. Never drive animation from React state, `setInterval` or render frequency.
- The server stores documents as opaque validated JSON; do not add musical logic to Laravel.
- Business logic in Laravel lives in Action classes; controllers stay thin; authorisation via Policies.

## 4. alphaTab rules

1. Version is pinned to **1.9.0** exactly. Upgrades only via a dedicated task including license review (license may change in future versions) and adapter regression tests.
2. **Do not assume capabilities.** Before using any alphaTab API, check MUSIC_ENGINE.md §2. If it's marked ⚠️ or missing, verify it in the official docs/source and update the audit table with the evidence. If it's ❌, do not try to work around by patching alphaTab.
3. Never persist alphaTab objects, alphaTab JSON (`JsonConverter`) or alphaTab runtime IDs. Persist only MHD.
4. Never mutate an alphaTab `Score` after it has been rendered; build a fresh one through `toAlphaTab()` and call `finish()`.
5. Do not modify, vendor or monkey-patch alphaTab source (MPL‑2.0 obligations). Needed fixes go upstream or through a documented, published fork (ADR required).
6. Keep the "♪ alphaTab.net" attribution exactly as alphaTab renders it (PROJECT_SPEC §7, Q9). Never remove, hide, crop, cover, clip or restyle it away (CSS, overlays, container sizes, SVG/canvas post-processing), on any platform. Changing its placement requires written maintainer permission recorded in `docs/legal/alphatab-attribution.md` plus an ADR; agents never make that change on their own.
7. MPL‑2.0: keep alphaTab license headers; list alphaTab (and Bravura, SONiVOX) in the third-party notices; any modified alphaTab file must be published under MPL‑2.0 (only via an approved fork ADR).
8. Next.js integration follows the documented Turbopack setup (ARCHITECTURE.md §4); do not add the webpack plugin unless the ADR switches to `--webpack`.

## 5. Music model rules

- Every structural change to MHD requires: schema update, `schemaVersion` bump if not additive, migration, fixtures, MUSIC_ENGINE.md update.
- All edits go through `editor-core` commands with inverses; no direct mutation from UI code.
- Documents are immutable values (structural sharing). No in-place mutation outside command implementations' internal builders.
- Editor state lives in the `editor-core` Zustand vanilla store. UI code reads it through selectors and changes the document only by dispatching commands. Never put per-frame playback data (clock, active notes) into Zustand or React state.
- Preserve unknown `extensions` on load/save.
- Time: ticks at PPQ 960; ms is derived, never stored.

## 6. Code quality

- TypeScript `strict`, no `any` (use `unknown` + narrowing), no non-null assertions without comment.
- UI: build web components on shadcn/ui inside `packages/ui`, themed only through tokens; forms with React Hook Form + Zod.
- Formatting: Prettier (TS/JSON/YAML; Markdown specs excluded) and Laravel Pint (PHP).
- PHP: strict types, Larastan/PHPStan level ≥ 8, Laravel Pint.
- Small, focused modules; no speculative abstractions; no unused code; no boilerplate "for later".
- Product name: always "MusicHub" in user-facing text, docs and metadata; do not rename technical identifiers (`@musichub/*`, `musichub`, `Mhd*`) for branding (PROJECT_SPEC.md §1.1).
- Naming: domain terms from MUSIC_ENGINE.md (bar, beat, voice, staff, track, masterBar). UI copy uses glossary terms.
- Errors: never swallow; typed error results in pure packages; problem-details responses in API.
- No secrets, tokens or personal data in code, logs, fixtures or test snapshots.
- Practice data is private: only `/me/practice/*` may return it; never join it into community/public queries or analytics without an approved decision. Store aggregates only; never persist raw audio or MIDI event streams.
- Comments explain *why*, not *what*.

## 7. Testing

| Layer | Required |
|---|---|
| music-model, editor-core | Unit tests for every command, invariant and timeline rule (Vitest). Property-based tests for command/inverse round-trip encouraged. |
| music-engine | Adapter golden tests (fixture → MHD snapshot), round-trip tests, timeline-parity tests vs `MidiFileGenerator` |
| practice-core, midi-engine | Evaluation tables with fake clock/input; MIDI message parsing; scheduler timing with fake timers |
| piano-visualizer | Geometry + culling unit tests, deterministic snapshot at fixed times |
| API (Laravel) | Pest feature tests per endpoint incl. authorisation (private data never leaks), validation, rate limits |
| Web | Component tests for logic-heavy components; Playwright e2e for critical flows (open file, play, edit, save, conflict) |

- A task is done only when lint, typecheck and relevant tests pass locally. Report exact commands and results; never claim tests pass without running them.
- Fixtures must be legally usable (own work, public domain, or explicit license). Never commit copyrighted commercial tabs.

## 8. Workflow

- Branch per task: `feat/…`, `fix/…`, `chore/…`, `spike/…`. Conventional Commits.
- One logical change per PR; include: what/why, linked roadmap item, docs updated, test evidence, screenshots for UI.
- Do not commit generated files except `packages/api-client` output (deterministic).
- Database: migrations only, never edit an applied migration; update DATABASE.md in the same PR.
- Dependencies: only libraries approved in PROJECT_SPEC.md §5.1–5.2 may be added, and only from the phase listed there; anything else needs owner approval first (Three.js is explicitly not approved). Every addition still needs a justification in the PR (size, license, maintenance). Allowed licenses: MIT, ISC, BSD, Apache‑2.0, MPL‑2.0 (unmodified), OFL (fonts). GPL/AGPL/unknown → ask.
- Do not touch unrelated files; do not reformat whole files.
- Never run destructive commands (dropping databases, force-pushing, deleting user data) without explicit human approval.

## 9. Which document to read

| Task touches | Read |
|---|---|
| Anything | AGENTS.md, PROJECT_SPEC.md, ROADMAP.md |
| Repo structure, packages, sync, deploy | ARCHITECTURE.md |
| Tables, migrations | DATABASE.md |
| Endpoints, client | API.md + `openapi/openapi.yaml` |
| alphaTab, model, playback, IO, editor, piano roll, MIDI | MUSIC_ENGINE.md |
| Falling notes / keyboard / practice | PIANO_VISUALIZER.md |
| UI, tokens, components | DESIGN_SYSTEM.md |
| Expo apps | MOBILE.md |

## 10. Definition of done

- [ ] Acceptance criteria met, nothing extra.
- [ ] Lint, typecheck, tests pass (commands + output summarised).
- [ ] Specs/ADRs updated where behaviour or contracts changed.
- [ ] No new risk left undocumented — add it to the relevant risk table.
- [ ] Accessibility and i18n respected for UI changes.
