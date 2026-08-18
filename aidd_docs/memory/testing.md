# Testing

## Strategy

- Co-located Vitest unit tests cover pure library logic and Zustand store contracts.
- Playwright E2E tests drive the real French-labelled UI and cover editor interaction, persistence, accessibility recovery, and export.
- Export tests and `scripts/validate-export.mjs` enforce exact dimensions, opaque PNG output, and ZIP structure.
- `scripts/visual-probe.mjs` and the contrast audit guard the design system outside ordinary assertions. The contrast audit checks an ink × surface matrix plus closed pairs an ink that only lands on one surface would otherwise escape.
- `apps/backend/convex/*.test.ts` run under `convex-test` and cover authorization from the attacker's point of view. Only the third party is faked: real webhook signatures, the real SDK parser, the real mutations.
- What the simulator does **not** cover is exercised by the strict Playwright gate against the real local engine: document size limits, cron execution, and transport behavior. Only failures specific to hosted infrastructure remain manual.

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
- `pnpm run test:e2e`: local Chromium suite; the cloud project is omitted when Convex is not already running.
- `pnpm run test:e2e:release`: strict Chromium suite; Playwright starts Convex on 3210/3211 and fails if any cloud prerequisite is absent.
- `pnpm run test:release`: complete release proof with dependency and publication audits, one production build, strict Cloud E2E and visual/security audits.
- Run all commands from the workspace root; root scripts delegate to the owning package.
- `pnpm --filter backend run test:unit`: the deployment suite (already included in `pnpm run test:unit`).
- Aggregate commit and release gates are defined in `coding-assertions.md`.
- GitHub runs Quality on `main` and pull requests. Production runs only from a canonical Release Please SemVer tag; diagnostics are scanned before their three-day upload.
- Internal branches also receive a protected Vercel Preview. The deployment
  audit proves that `main` stays disabled, PR workflows receive no Vercel token,
  and only the public `VITE_CONVEX_URL` is configured for Preview.
