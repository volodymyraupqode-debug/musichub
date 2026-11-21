# MusicHub — Design System

> Status: Draft v0.2 (audited 2026‑11‑21) — awaiting approval. Packages: `design-tokens` (source of truth), `ui` (web React components). Mobile consumes tokens (MOBILE.md §7).
> **Changelog v0.2:** added practice feedback tokens, the Practice view and the license column reference (PROJECT_SPEC §5.1).
>
> **Changelog v0.2.1:** Q2 resolved. **shadcn/ui** (Tailwind CSS v4 + Radix primitives) is the web component base; React Hook Form for forms; Canvas 2D for visualisations; Three.js not used.
>
> **Approved stack (PROJECT_SPEC §5.1):** shadcn/ui components are generated into `packages/ui` and owned by us (MIT). Tailwind CSS v4 reads the token CSS variables, and Radix supplies accessible behaviour. Mobile uses separate RN components (shadcn/ui is web-only).

## 1. Principles

1. **Tool, not toy.** Dense, calm, professional studio UI; the score and visualizer are the hero, chrome recedes.
2. **Dark-first, light equal.** shadcn/ui theming is mapped to the semantic tokens below (`--background`, `--foreground`, `--primary`… → `color.bg.*`, `color.text.*`, `color.accent.*`). Both themes are first-class; notation paper can stay light inside dark chrome (user setting).
3. **Keyboard-first in the studio.** Every editor action has a shortcut and a visible focus state.
4. **Original identity.** Do not imitate Guitar Pro's layout, icons or colors.
5. **Tokens only.** Components never hard-code colors, spacing, radii or fonts.

## 2. Token structure

`packages/design-tokens/tokens.json` (W3C Design Tokens format) → build script emits:

- `dist/tokens.css` — CSS variables for `:root`, `[data-theme="dark"]`, `[data-theme="light"]`.
- `dist/tokens.ts` — typed object for React Native and canvas renderers (visualizer, piano roll, alphaTab resources).

Tiers:

| Tier | Example | Used by |
|---|---|---|
| Primitive | `color.gray.900`, `space.4`, `radius.md` | tokens only |
| Semantic | `color.bg.surface`, `color.text.muted`, `color.accent.default`, `color.border.subtle` | components |
| Domain | `color.track.1…12`, `color.hand.left/right`, `color.key.pressed`, `color.key.live`, `color.practice.correct/early/late/wrong/missed`, `color.notation.ink`, `color.notation.paper`, `color.cursor.beat`, `color.selection` | studio, visualizer, practice, alphaTab |

## 3. Foundations

| Foundation | Values |
|---|---|
| Spacing | 4 px base: 0, 2, 4, 8, 12, 16, 24, 32, 48, 64 |
| Radius | `sm 4`, `md 8`, `lg 12`, `full` |
| Typography | UI: Inter (variable, OFL); mono (fret entry, timecodes): JetBrains Mono (OFL). Scale 12/13/14/16/20/24/32. Studio default 13 px. |
| Notation font | Bravura (SMuFL, OFL) bundled by alphaTab — do not replace |
| Elevation | 3 levels via shadow + surface tint |
| Motion | 120 ms (micro), 200 ms (panels); `prefers-reduced-motion` respected |
| Breakpoints | `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Studio requires ≥ `lg` for editing; below → viewer/player mode |
| Icons | Lucide (ISC) for UI; custom SVG set for music techniques (bend, slide, palm mute…), drawn in-house |

## 4. Color

- Neutral grays (slightly cool), one **accent** (MusicHub brand color, to be chosen in Phase 1 together with the logo), semantic `success/warning/danger/info`.
- **Track palette:** 12 distinguishable hues, checked for color-blind separability (deuteranopia/protanopia) and ≥ 3:1 contrast against waterfall background in both themes. Tracks store a palette id (`track.color`), not hex.
- Text contrast ≥ 4.5:1 (WCAG AA), large text and UI glyphs ≥ 3:1.

## 5. alphaTab theming

alphaTab colors/fonts are set through `display.resources` (and per-element styling since 1.5). `music-engine` exposes `applyTheme(tokens)` mapping:

| alphaTab resource (verify exact names in spike S1) | Token |
|---|---|
| staff lines, bar separators, main glyphs | `color.notation.ink` |
| secondary glyphs (fingering, annotations) | `color.notation.inkMuted` |
| score title/subtitle fonts | UI font family |
| background (container CSS) | `color.notation.paper` |

Cursor and editor selection are our overlay (`color.cursor.beat`, `color.selection`). Loop-range highlighting uses alphaTab's Selection API (`highlightPlaybackRange`), styled via CSS where possible. Theme switching triggers a re-render. The "♪ alphaTab.net" attribution stays exactly as alphaTab renders it in both themes (PROJECT_SPEC §7, Q9). Score containers reserve space for it; padding, overflow and scroll containers must not clip it. Ink colors chosen for `display.resources` must keep it legible. Any restyling or relocation needs written maintainer permission.

## 6. Components (packages/ui)

**Primitives** (shadcn/ui based, restyled with MusicHub tokens; never imported from a CDN or left as unthemed defaults): Button (primary/secondary/ghost/danger, sizes sm/md), IconButton, Toggle, ToggleGroup, Input, Textarea, Select, Combobox, Slider (volume/pan/speed), Checkbox, Switch, Tabs, Tooltip (with shortcut hint), Popover, Menu/ContextMenu, Dialog, Sheet/Drawer, Toast, Avatar, Badge, Skeleton, EmptyState, Pagination ("Load more").

**Studio components:** Transport bar (play/pause/stop, position, tempo, speed, loop, metronome, count-in), Track list + mixer strip (mute/solo/volume/pan/instrument), Toolbar/Palette for durations and techniques, Inspector panel (bar/beat/note properties), Fretboard input widget (optional), Bottom panel tabs (Visualizer / Piano Roll / Mixer), Status bar (selection, bar:beat, warnings), Keyboard-shortcut sheet.

**Practice components:** PracticeToolbar (hand, mode, speed, loop, count-in), FeedbackLegend, LoopStatsPanel, MidiDeviceSelect, CalibrationDialog.

**Community components:** CompositionCard, CompositionHeader, ProfileHeader, FollowButton, LikeButton, CommentThread, CommentComposer, TagChips, FeedList, ReportDialog.

Forms (sign-in, settings, composition metadata, comments) use React Hook Form with Zod schemas shared with API validation messages.

Each component: typed props, `forwardRef` (or React 19 `ref` prop), keyboard behaviour per WAI-ARIA, light/dark stories, visual regression test (Storybook + Playwright, introduced in Phase 1).

## 7. Studio layout

```
┌───────────────────────────────────────────────────────────────┐
│ Top bar: file / title / save state / share │ transport         │
├──────────┬──────────────────────────────────────────┬─────────┤
│ Tracks + │  Score canvas (alphaTab) + overlay       │Inspector│
│ mixer    │                                          │         │
├──────────┴──────────────────────────────────────────┴─────────┤
│ Bottom panel: Piano Visualizer | Piano Roll | (Mixer)         │
├───────────────────────────────────────────────────────────────┤
│ Status bar                                                    │
└───────────────────────────────────────────────────────────────┘
```

Panels are collapsible and resizable; the layout is persisted in user settings.

**Practice view** (`/practice/[id]`): the visualizer fills the main area, an optional single-system score strip sits on top, and the practice toolbar sits at the bottom. It is designed for desktop and tablet widths.

## 8. Content & i18n

- Product name "MusicHub" comes from a single i18n constant (`app.name`) and is never translated or abbreviated. Page titles follow `<Page> · MusicHub`.
- All strings via i18n keys (`next-intl`, approved); EN source, UK translation. No string concatenation for sentences.
- Musical terminology glossary maintained in `docs/glossary.md` (EN/UK) — e.g. "bar" (not "measure") in UI copy.
