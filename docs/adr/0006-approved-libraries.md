# ADR-0006: Approved libraries and toolchain

- **Status:** Accepted
- **Date:** 2026-11-21
- **Spec sections:** PROJECT_SPEC.md §5, §5.1, §5.2 (Q2, Q2b, Q12)

## Decision

- Runtime/toolchain: Node.js 26 LTS (`.nvmrc` 26.13.1, `engineStrict`), pnpm 12.21 (`packageManager`), Turborepo 2.11, TypeScript 6.0 (strict), ESLint 10 + typescript-eslint 8, Prettier 3, PHP 8.4, Laravel 13, Composer 2.
- Libraries: only those listed in PROJECT_SPEC.md §5.1–5.2, introduced no earlier than the phase listed there. Three.js is not approved.
- Shared tool versions live in the pnpm catalog (`pnpm-workspace.yaml`).

## Notes from Sprint 1

- ESLint stays on 10: ESLint 9 is marked "no longer supported" on npm. `eslint-plugin-react` 7.37 and `eslint-plugin-jsx-a11y` 6.10 declare peers up to ESLint 9 but were verified to work on ESLint 10 (with an explicit React version setting); the peer ranges are allowed in `peerDependencyRules`.
- `openapi-typescript` 7.13 declares `typescript ^5` but generates correctly with TypeScript 6 (verified); allowed in `peerDependencyRules`.
- MinIO no longer publishes container images; the S3-compatible local storage service is pending an owner decision (see ROADMAP.md S1-07).
