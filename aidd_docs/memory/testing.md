# Testing

## Strategy

- Co-located Vitest unit tests cover pure library logic and Zustand store contracts.
- Playwright E2E tests drive the real French-labelled UI and cover editor interaction, persistence, accessibility recovery, and export.
- Export tests and `scripts/validate-export.mjs` enforce exact dimensions, opaque PNG output, and ZIP structure.
- `scripts/visual-probe.mjs` and the contrast audit guard the design system outside ordinary assertions. The contrast audit checks an ink × surface matrix plus closed pairs an ink that only lands on one surface would otherwise escape.
- `apps/backend/convex/*.test.ts` run under `convex-test` and cover authorization from the attacker's point of view. Only the third party is faked: real webhook signatures, the real SDK parser, the real mutations.
- What the simulator does **not** cover, and which is therefore checked by hand against a real deployment: document size limits, cron execution, and the engine's own error messages.

## Tools

- Vitest for unit tests; `fake-indexeddb` supplies browser storage in tests.
- Playwright runs Chromium serially against Vite on port 5199 and retains traces on failure.
- `tsconfig.tools.json` type-checks Playwright specs/config, Vite config, and checked JavaScript scripts.

## Conventions

- Unit tests live in `src/**/__tests__/*.test.ts`; browser tests live in `e2e/*.spec.ts`.
- E2E selectors use accessible French labels; development-only `window.__sfCanvas` and `window.__sfStores` are reserved for state contracts the UI cannot expose.
- Canvas transforms must assert the canvas → store → sync round-trip does not drift after pointer release.
- Any export-path change must retain the pixel-exact E2E contract.
- `runtime-resilience.spec.ts` forces IndexedDB startup failure and delays a lazy chunk to cover the editable memory fallback, persistent warning, loading status, and final dialog focus.

## Run

- `pnpm run test:unit`: unit suite.
- `pnpm run test:e2e`: Chromium E2E suite. Playwright must be invoked from `apps/web` (`pnpm --filter web exec playwright test`) — run from the root it finds no config and loses `baseURL`.
- `pnpm --filter backend run test:unit`: the deployment suite (already included in `pnpm run test:unit`).
- Aggregate commit and release gates are defined in `coding-assertions.md`.
- GitHub runs the release gate on every push and pull request and uploads Playwright diagnostics on failure.
