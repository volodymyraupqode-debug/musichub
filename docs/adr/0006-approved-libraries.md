# ADR-0006: Approved libraries and toolchain

- **Status:** Accepted (updated 2026-11-21 after Sprint 1: D1, D2, D3; storage moved to ADR-0007)
- **Date:** 2026-11-21
- **Spec sections:** PROJECT_SPEC.md §5, §5.1, §5.2 (Q2, Q2b, Q12, Q22)

## Decision

- **Runtime/toolchain:**
  - Node.js 26 LTS (`.nvmrc` 26.13.1, `engines` `>=26.13.0 <27`, `engineStrict`); pnpm 12.21 (`packageManager`); Turborepo 2.11; Prettier 3.
  - **TypeScript 6.0.3 for every package** (D2), via the pnpm catalog.
  - **ESLint 10.15** + `@eslint/js` 10 + typescript-eslint 8.73 (D1).
  - **PHP 8.4** (D3), Laravel 13, Composer 2.
- **Libraries:** only those listed in PROJECT_SPEC.md §5.1–5.2, introduced no earlier than the phase listed there. Three.js is not approved.
- **Versions:** shared tool versions live in the pnpm catalog (`pnpm-workspace.yaml`); packages reference them with `catalog:`.

## D1 — ESLint 10 (replaces the approved ESLint 9 plan)

- **Reason:** ESLint v9.x reached end of life on **2026-08-06** (eslint.org/version-support, "EOL Start"). npm marks 9.39.5 as "no longer supported". v10.x is the only supported line.
- **Plugin compatibility (verified in Sprint 1 with a probe file that triggered each rule):**
  - `eslint-plugin-react-hooks` 7.1: officially supports ESLint 10.
  - `@next/eslint-plugin-next` 16.4.6: no peer range; works.
  - `eslint-plugin-react` 7.37.5 and `eslint-plugin-jsx-a11y` 6.10.2: peer ranges stop at ESLint 9, but both work on ESLint 10.
- **React version:** `eslint-plugin-react`'s `version: 'detect'` crashes on ESLint 10 (`contextOrFilename.getFilename is not a function`). Therefore `packages/config/eslint/react.js` sets `settings.react.version: '19.3'`, which must be kept in sync with the `react` catalog entry.
- **Peer exceptions:** both peer exceptions are allowed in `pnpm-workspace.yaml` → `peerDependencyRules.allowedVersions`. `pnpm peers check` reports no issues. The lockfile contains only ESLint 10.15.0.
- **Re-check:** when either plugin publishes ESLint 10 support, drop its peer exception (and the explicit React version if `detect` is fixed).
- **CI** uses the same lockfile (`pnpm install --frozen-lockfile`), so the same versions.

## D2 — single TypeScript 6

`openapi-typescript` 7.13 declares `typescript ^5.x` but generates correctly with TypeScript 6.0.3 (verified: deterministic output, generated types compile in `api-client` and `web`). No separate TypeScript 5 is installed. The peer exception is in `peerDependencyRules`. All four workspace packages resolve `typescript@6.0.3` (`pnpm ls -r typescript`).

## D3 — PHP 8.4 locally via `php84`

- `apps/api/composer.json` requires `"php": "^8.4"` with `platform-check`. CI uses `shivammathur/setup-php` with `php-version: '8.4'`.
- **Locally with Laravel Herd** the default `php` may be older (8.2 on the reference machine). Run PHP 8.4 explicitly as `php84` and Composer as `php84 "$(which composer)" …`.
- `herd isolate` is **not** required: it only works for sites registered in Herd, and the API is not served by Herd. Any other PHP 8.4 install (Homebrew, php.new, Docker) works the same way.

## Storage

The S3-compatible local storage decision moved to ADR-0007 (SeaweedFS). MinIO is no longer an approved default.
