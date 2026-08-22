# Testing

## Strategy

- Co-located Vitest unit tests cover pure library logic and Zustand store contracts.
- Playwright E2E tests drive the real French-labelled UI and cover editor interaction, persistence, accessibility recovery, and export.
- Export tests and `scripts/validate-export.mjs` enforce exact profile dimensions, opaque PNG output, ZIP structure, and the matching App Store Connect delivery type for iPhone, iPad, and all six Watch profiles.
- `scripts/visual-probe.mjs` and the contrast audit guard the design system outside ordinary assertions. The contrast audit checks an ink × surface matrix plus closed pairs an ink that only lands on one surface would otherwise escape.
- `apps/backend/convex/*.test.ts` run under `convex-test` and cover authorization from the attacker's point of view. Only the third party is faked: real webhook signatures, the real SDK parser, the real mutations.
- What the simulator does **not** cover is exercised by the strict Playwright gate against the real local engine: document size limits, cron execution, and transport behavior. Only failures specific to hosted infrastructure remain manual.
- Security regressions exercise concurrent MCP offers and revocation leases, authenticated cache headers, hostile portable archives and the exact release-tag provenance check.

## Tools

- Vitest for unit tests; `fake-indexeddb` supplies browser storage in tests.
- Playwright runs Chromium serially against Vite on port 5199 by default and retains traces on failure. `SCREENFORGE_E2E_PORT` selects an isolated port when another worktree already owns 5199.
- `tsconfig.tools.json` type-checks Playwright specs/config, Vite config, and checked JavaScript scripts.

## Conventions

- Unit tests live in `src/**/__tests__/*.test.ts`; browser tests live in `e2e/*.spec.ts`.
- E2E selectors use accessible French labels; development-only `window.__sfCanvas` and `window.__sfStores` are reserved for state contracts the UI cannot expose.
- Canvas transforms must assert the canvas → store → sync round-trip does not drift after pointer release.
- Any export-path change must retain the pixel-exact E2E contract.
- `device-profiles.spec.ts` is the cross-platform acceptance journey: it creates iPad then Watch projects through the UI, checks platform-filtered frames/templates and the Apple license boundary, imports a local screenshot, and decodes the exported Watch PNG to prove its exact size and opacity.
- Project-format, store, AI/MCP, release and validator tests must cover the immutable profile contract, legacy iPhone default, incompatible-model rejection, template containment, and frozen release behavior.
- `runtime-resilience.spec.ts` forces IndexedDB startup failure and delays a lazy chunk to cover the editable memory fallback, persistent warning, loading status, and final dialog focus.

## Run

- `pnpm run test:unit`: unit suite.
- `pnpm run test:e2e`: local Chromium suite; the cloud project is omitted when Convex is not already running.
- `pnpm run test:e2e:release`: strict Chromium suite; Playwright starts Convex on 3210/3211 and fails if any cloud prerequisite is absent.
- `pnpm run test:release`: complete release proof with dependency and publication audits, one production build, strict Cloud E2E and visual/security audits.
- Run all commands from the workspace root; root scripts delegate to the owning package.
- `pnpm --filter backend run test:unit`: the deployment suite (already included in `pnpm run test:unit`).
- Aggregate commit and release gates are defined in `coding-assertions.md`.
- GitHub runs Quality on `main`, `preprod`, and pull requests. A successful push
  to `preprod` additionally deploys Convex only after all five checks, tree
  equality with `main`, and the current preflight; a second preflight validates
  the deployed candidate. Production runs only from a canonical Release Please
  SemVer tag; diagnostics are scanned before their three-day upload.
- Internal branches also receive a protected Vercel Preview. The deployment
  audit proves that `main` stays disabled, PR workflows receive no Vercel token,
  and only the public `VITE_CONVEX_URL` is configured for Preview.
