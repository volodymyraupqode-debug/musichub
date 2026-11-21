# ADR-0004: alphaTab integration under Next.js Turbopack

- **Status:** Proposed — to be finalised by spike S1 (Sprint 2)
- **Date:** 2026-11-21
- **Spec sections:** ARCHITECTURE.md §4; MUSIC_ENGINE.md §10 (S1)

## Context

Next.js 16 builds with Turbopack by default, which runs no webpack plugins. alphaTab 1.9.0 documents a Turbopack setup that copies its assets and sets `core.scriptFile`.

## Proposed decision

- Follow the documented setup: copy `font/`, `soundfont/`, `alphaTab.mjs`, `alphaTab.core.mjs` into `apps/web/public/alphatab/` in `predev`/`prebuild`; set `core.scriptFile`, `core.fontDirectory`, `player.soundFont`.
- Fallback if S1 fails: `next build --webpack` + `@coderline/alphatab-webpack`.

## Open points for S1

Whether rendering runs in a worker under Turbopack; production build; playback in Chrome, Firefox and Safari; the ~2.5 MB unminified core for the worklet.
