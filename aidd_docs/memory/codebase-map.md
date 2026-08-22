# Codebase Map

```mermaid
flowchart TD
    Entry["src/main.tsx"] --> App["src/App.tsx"]
    App --> Components["src/components"]
    Components --> Hooks["src/hooks"]
    Hooks --> Stores["src/stores"]
    Components --> Stores
    Components --> Lib["src/lib"]
    Hooks --> Lib
    Stores --> Lib["src/lib"]
    Components --> Assets["src/assets"]
    Assets --> Lib
    Tests["src/**/__tests__ and e2e"] --> App
```

## Areas

Paths below are relative to `apps/web/` unless stated otherwise; the repository root now holds only tooling and `apps/`.

- `src/components/`: editor chrome, feature panels, dialogs, and JSX local to each feature, over two shared layers — `ui/` is coss ui (Base UI), installed by the shadcn CLI from the `@coss` registry and never edited by hand (`pnpm run audit:ui` guards it); `patterns/` is ScreenForge's own composition on top of coss for what the registry has no primitive for (`Island`, `PropertyRow`, `UnitField`, `Segmented`, `SwatchButton`, `ConfirmAction`…). Account, pricing, migrate and export dialogs are lazy chunks.
- `src/design-system/`: the project's one extension layer over coss — `tokens.css` (stage, marker, artboard, guide, shadow-handle, z-levels), `motion.css` (durations, easings, reduced-motion), `stage.css` (stage grain, marker utilities, squircle, filmstrip scroll).
- `src/hooks/`: React lifecycle orchestration for canvas, keyboard, export, and layer actions.
- `src/stores/`: project, canvas, history, UI, toast, and auth state domains.
- `src/lib/`: persistence, export, fonts, project-file, asset, dimension, shared domain logic, and Fabric helpers under `lib/canvas/`; the `install-*` modules isolate interactions, viewport and thumbnails with explicit cleanup. `lib` never imports components or hooks. The SaaS edge lives here too: `convex.ts` (lazy client, `cloudConfigured`, error codes), `cloud.ts` (transport: functions and authenticated `httpAction`s), `sync.ts` (cloud cycle and queue), `entitlements.ts` (Cloud-only commercial rule imported from the deployment), `plans.ts`, `account.ts` (checkout, portal, deletion).
- `src/landing/`: the marketing page, a second Vite entry (`landing.html`), pre-rendered at build in French and English.
- `src/assets/`: device-frame definitions, templates, and gradient presets.
- `src/types/`: shared project and layer model.
- `e2e/`: browser-level editor, pixel-exact export, tier and sync contracts. `pnpm test:e2e` may skip Cloud cases when local Convex is down; `pnpm test:e2e:release` starts Convex and forbids those skips.
- `apps/backend/`: the Convex deployment — `convex/` holds the schema and every function a client can reach (auth, authorization, project and asset sync, sale, account deletion) plus the cron; `tests/stack.ts` gives the e2e suite what only the backend can do.
- `apps/bridge/`: optional local daemon on 127.0.0.1, one token per capability.
- `scripts/`: export validation, contrast audit (browser-resolved, coss's tokens use `--alpha()`/`color-mix()` that no static parser reads), scale audit (counts values rendered in the populated DOM against coss's own type/height/radius steps), `ui-source-audit.mjs` (`pnpm run audit:ui`: every `components/ui/` file matches what the `@coss` registry serves for it, plus static passes for the pre-coss dependencies and slot-prop convention it replaced), and visual probes. Run from the repository root.
- `aidd_docs/tasks/`: scoped specs, plans, phases, and reviews for completed and active work.

## Entry points

- `src/main.tsx`: mounts React and exposes development-only test handles (`__sfStores`, `__sfAssets`), including the auth store in write so e2e can seed rights a real purchase would otherwise be needed for.
- `src/App.tsx`: initializes persistence and composes the single editor workspace.
- `src/lib/export.ts`: render/export critical path.
- `src/lib/storage.ts`: IndexedDB lifecycle and autosave boundary.
- `apps/backend/convex/authz.ts`: the wall — the one place that decides who may write.
- `apps/backend/convex/entitlements.ts`: the commercial rule, written once and imported by both sides.
