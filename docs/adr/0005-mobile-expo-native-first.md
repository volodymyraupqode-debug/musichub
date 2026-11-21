# ADR-0005: Mobile with Expo + React Native, native-first

- **Status:** Accepted (audio and visualizer placement decided by the Phase 2M prototype)
- **Date:** 2026-11-21
- **Spec sections:** MOBILE.md; PROJECT_SPEC.md Q11; ROADMAP.md Phase 2M, Phase 8

## Context

alphaTab has no iOS or React Native build. The owner chose Expo + React Native with shared TypeScript logic.

## Decision

- React Native screens and shared TS packages (`music-model`, `practice-core`, `api-client`, `design-tokens`, `piano-visualizer` geometry).
- Native modules (Expo Modules API) for MIDI and audio session; custom native audio only if the prototype requires it.
- WebView only for justified components, currently the `ScoreView` notation component. The web editor is never ported into a WebView.
- A mobile audio/MIDI prototype on real devices runs right after Phase 2 (Phase 2M) and is the gate for full mobile development.

## Pending (filled in after Phase 2M)

Audio option A1/A2/A3, visualizer option V1/V2, native module list, library approvals (Q18).
