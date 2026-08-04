# Testing

## Strategy

- Co-located Vitest unit tests cover pure library logic and Zustand store contracts.
- Playwright E2E tests drive the real French-labelled UI and cover editor interaction, persistence, accessibility recovery, and export.
- Export tests and `scripts/validate-export.mjs` enforce exact dimensions, opaque PNG output, and ZIP structure.
- `scripts/visual-probe.mjs` and the contrast audit guard the design system outside ordinary assertions.

## Tools

- Vitest for unit tests; `fake-indexeddb` supplies browser storage in tests.
- Playwright runs Chromium serially against Vite on port 5199 and retains traces on failure.
- `tsconfig.tools.json` type-checks Playwright specs/config, Vite config, and checked JavaScript scripts.

## Conventions

- Unit tests live in `src/**/__tests__/*.test.ts`; browser tests live in `e2e/*.spec.ts`.
- E2E selectors use accessible French labels; development-only `window.__sfCanvas` and `window.__sfStores` are reserved for state contracts the UI cannot expose.
- Canvas transforms must assert the canvas → store → sync round-trip does not drift after pointer release.
- Any export-path change must retain the pixel-exact E2E contract.

## Run

- `pnpm run test:unit`: unit suite.
- `pnpm run test:e2e`: Chromium E2E suite.
- Aggregate commit and release gates are defined in `coding-assertions.md`.
- GitHub runs the release gate on every push and pull request and uploads Playwright diagnostics on failure.
