# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

**ScreenForge** — Local-first web app for designing and exporting iPhone App Store screenshots. Local is free and complete without a backend; the optional managed Cloud account, sync and storage service is paid.

See `PRD.md` for full spec. Key constraint: exported PNGs must be pixel-exact (1320x2868 for 6.9", etc.) and pass App Store Connect validation.

## Tech Stack

| Layer   | Choice                                                     | Version               |
| ------- | ---------------------------------------------------------- | --------------------- |
| Build   | Vite                                                       | latest                |
| UI      | React + TypeScript                                         | React 19              |
| Canvas  | Fabric.js                                                  | v7                    |
| State   | Zustand                                                    | v5+                   |
| Styling | Tailwind CSS                                               | v4 (CSS-first config) |
| Storage | IndexedDB via `idb`                                        | —                     |
| Fonts   | Google Fonts API                                           | on-demand             |
| Icons   | Lucide React                                               | —                     |
| Export  | Fabric.js `toDataURL({ multiplier })` / `toBlob()` + JSZip | —                     |

## Commands

Every command runs from the repository root; the root scripts delegate to the
workspace package that owns them (`pnpm --filter web …`). Never `cd apps/web`
to run a script — the audits and probes in `scripts/` resolve their paths from
the root and would read the wrong tree.

```bash
# Dev
pnpm run dev

# Build (Vite + prerender of the two landing documents)
pnpm run build

# Preview production build
pnpm run preview

# Lint (one flat config at the root, covering every package)
pnpm run lint

# Type check
pnpm run typecheck

# E2E local (omet le projet cloud si Convex est arrêté)
pnpm run test:e2e

# E2E de release (démarre Convex et interdit les skips cloud)
pnpm run test:e2e:release

# Gate complet de release
pnpm run test:release

# Local Convex deployment (anonymous) — ports 3210/3211
pnpm run dev:backend

# Deploy the backend to preprod, then to production
pnpm run deploy:preprod
pnpm run deploy:prod

# Validate or deploy the immutable release selected by a SemVer tag
pnpm run test:release-tag
pnpm run verify:release-tag v0.1.0

# Validate an exported ZIP against App Store rules
pnpm run validate:export -- <file.zip>
```

## Testing

- E2E specs live in `apps/web/e2e/`, driven through the real UI (French aria labels) plus two dev-only debug handles: `window.__sfCanvas` (Fabric instance, exposed by `use-canvas`) and `window.__sfStores` (Zustand stores, exposed by `main.tsx`), both only when `import.meta.env.DEV`.
- Transform specs assert the canvas → store → sync round-trip does not move objects after mouse release — the historical "drifting handles" bug class. Panel inputs are located by aria-label ("Position X", "Largeur", "Rotation"…), never positionally.
- `e2e/export.spec.ts` verifies the exported ZIP is pixel-exact (1320×2868, PNG-24 opaque) — the critical path.
- `e2e/command-palette.spec.ts` covers the ⌘K palette and history coalescing (nudge burst = one undo step).
- `scripts/visual-probe.mjs` screenshots the app for design review; `scripts/export-probe.mjs` drives a real export end-to-end and validates the ZIP (requires the dev server on :5199).

## Architecture

### Workspace

```
.                          # pnpm workspace root — tooling only, no product code
  pnpm-workspace.yaml      # packages: apps/* + packages/*
  package.json             # root scripts delegate to --filter web; eslint/prettier/husky live here
  eslint.config.js         # one flat config for every package (patterns are apps/*/… and packages/*/…)
  .env.example             # single env file for the whole stack; apps/web reads it via envDir
  scripts/                 # audits and probes — resolve paths from the root, run from the root
  packages/
    project-format/        # the project contract: types, validation, dimensions, AI tool schemas
  apps/
    web/                   # the editor + the landing, the app that used to be the repository
      index.html           # editor entry
      landing.html         # marketing entry (prerendered per language at build)
      e2e/ src/ public/
    backend/               # the Convex deployment: schema, auth, authorization, sale, deletion
      convex/              # functions — the only surface a client can reach
      tests/stack.ts       # what only the backend can do (internal mutations), for the e2e suite
    bridge/                # optional local daemon: 127.0.0.1 only, spawns `codex app-server`
    mcp/                   # optional local daemon: MCP on stdio for an agent, SSE relay to the open tab
```

`backend`, `bridge` and `mcp` are declared as `devDependencies` of `web` so a
renamed contract breaks at compile time rather than at runtime. The backend's
`api` and `Entitlements` also arrive through a dynamic `import()`, so no
deployment code sits in the critical bundle — `e2e/boot-shell.spec.ts` measures
it. Bridge and MCP contracts remain type-only.

`packages/project-format` is the exception: it is a real dependency, imported at
runtime by the editor and by `apps/mcp`. It is consumed **as source** — its
`exports` point at `src/index.ts`, which vite compiles for the browser and Node
reads by stripping types. The `build` script only proves it compiles alone,
without Fabric and without the DOM; nothing consumes `dist/`.

`@types/react` and `@types/react-dom` are declared **twice** on purpose: in
`apps/web` because the app imports them, and at the root because a dependency's
`.d.ts` that imports `react` without declaring `@types/react` as a peer (cmdk)
resolves its types by walking up from `node_modules/.pnpm/`, a path that never
crosses `apps/web/node_modules`. Without the root copy those props degrade to
`any` silently, and `noImplicitAny` fails somewhere unrelated.

### Application

```
apps/web/src/
  components/
    ui/                  # Design-system primitives (CVA): Button, IconButton, Input,
                         # NumberField (scrub), Slider, Segmented, Switch, Field, Select,
                         # Textarea, SwatchButton, Dialog, Popover, Dropdown, Tooltip,
                         # Kbd, CommandPalette, ToastViewport
    canvas/              # Fabric.js canvas wrapper + interactions
    toolbar/             # TopBar (project + tools + export), ZoomHud
    layers-panel/        # LayersDrawer (overlay) + layer list (search, groups, DnD),
                         # memoized LayerItem
    properties-panel/    # PropertiesDrawer (overlay) + sections (Transform, Text, Device,
                         # Image, Shape, Background) + shared ShadowEditor
    screens-bar/         # Floating screens strip, memoized ScreenThumbnail
    background-editor/   # Solid + gradient + preset backgrounds
    device-picker/       # iPhone frame selection + config
    text-editor/         # Typography controls + FontPicker
    template-picker/     # Template gallery dialog
    globals-editor/      # Project defaults dialog
    export-dialog/       # Export config + batch export
    color-picker/        # Color + alpha picker (recent colors)
    gradient-editor/     # Color stop editor
  stores/
    canvas.store.ts      # Layers, selection, active screen — facade over project.store
    project.store.ts     # Project metadata, screens, globals — source of truth
    history.store.ts     # Undo/redo snapshots with burst coalescing
    ui.store.ts          # Panel/dialog flags, zoom, theme
    toast.store.ts       # Toast queue (module-level, no React subscription needed)
  hooks/
    use-canvas.ts        # Fabric lifecycle + granular sync (diff → patch | full)
    use-keyboard.ts      # Shortcuts (⌘K palette, nudges coalesced, clipboard)
    use-export.ts        # Batch export, bounded parallelism (2 workers)
    use-fonts.ts         # Google Fonts loader (content fonts, on-demand)
    use-layer-actions.ts # Shared layer actions (imperative getState, stable refs)
  assets/
    device-frames/       # iPhone SVG mockups (per model + color)
    templates/           # Template definitions (JSON + thumbnail)
    gradients.ts         # Preset gradient definitions
  lib/
    dimensions.ts        # Apple dimension constants — MUST match PRD table exactly
    assets.ts            # Binary asset registry (data URLs OUT of the layer graph)
    storage.ts           # IndexedDB v2 (projects + assets tables), migration, autosave
    export.ts            # Canvas-to-PNG at target dimensions
    zip.ts               # ZIP generation via JSZip
    commands.ts          # ⌘K command registry
    layer-factories.ts   # Add-layer defaults (single source)
    stage.ts             # Floating-chrome insets for canvas fit
    image.ts / number.ts # Shared image + numeric helpers
    utils.ts             # cn() helper (clsx + tailwind-merge)
  types/
    index.ts             # Layer, Screen, Project, ExportConfig types
```

**Key data flow**: Zustand stores are the single source of truth. The Fabric.js canvas syncs bidirectionally with `canvas.store.ts`. User edits on canvas -> store update -> properties panel reflects. Properties panel edit -> store update -> canvas re-renders.

**Binary assets (v2)**: image layers and device screenshots hold a short `assetId`, never a data URL. Payloads live in `lib/assets.ts` (in-memory registry, hash-deduped) and persist in the IDB `assets` table; `storage.ts` migrates v1 inline data URLs on load. History snapshots, autosave and sync diffs stay tiny as a result.

**Granular sync (v2)**: `use-canvas.ts` diffs project references (`diffProjectChange`) — single-screen, same-stacking-order changes take the in-place `syncPatch` path (no clip/z-order rebuild); structural changes fall back to full reconciliation.

**No object cache, no `clipPath`**: layer objects set `objectCaching = false`, and screen clipping goes through `clipContentToScreen` (a `ctx.clip()` inside a wrapped `render`), never Fabric's `clipPath` property. Both rules exist for the same reason: any object Fabric caches gets blitted back at a fractional offset with bilinear filtering, so every edge is antialiased twice — measured at 2× the soft-edge pixels on screen and in the exported PNG. Setting `clipPath` re-forces the cache via `needsItsOwnCache()` regardless of `objectCaching`.

**History coalescing (v2)**: `history.store.record(snapshot, coalesceKey)` collapses bursts (slider drags, scrubs, arrow nudges) into one undo step (1200ms window, keeps the FIRST pre-state). Panel editors pass `coalesceKey: layer:{id}:{prop}` to `updateLayer`.

## Design language (v5)

- **Réduction maximale**: the canvas is full-bleed; a single top bar (`TopBar`, h-12) holds project identity, tools and the Export CTA. Layers/Properties are overlay **drawers** (⌘⇧L / ⌘⇧P, Escape closes them before deselecting) — `lib/stage.ts` is the single source for chrome geometry; `stageInsets()` reserves only bar, filmstrip and margins (drawers never move the artboard). Selecting a layer does **not** open the Properties drawer: the contextual `SelectionToolbar` sits under the selection while the drawer is closed.
- **True neutral**: all colors OKLCH in `src/index.css` `@theme` (dark default + `.light`), chroma 0 on every chrome surface — a colour-judgement tool must not tint what sits next to the artboard.
- **One accent, for state only**: lime `--color-accent`, reserved for "you are here" — current screen, selected layer, focus ring (`accent-fill` / `accent-mark`, declared as `@utility` so they take variants). Never on an action: the Export CTA is a plain light fill, and drawer toggles stay neutral. Nothing chromatic touches the artboard (`--color-artboard-ring-active`, selection frame and snapping guides stay neutral).
- **Type**: Inter variable (UI, `index.html`), 13.5px body, `.panel-title` / `.section-title` / `.field-label`, tabular figures for numeric fields. No all-caps labels. Content fonts (text layers) load on demand — `use-fonts.ts` clears Fabric's char-width cache after each load.
- **Radii, elevation & z**: 9px controls, 14px islands, 18px modals, inner radius = outer − padding; surfaces separate by material (`panel` / `inset` / `raised`) with shadows only on floating ones; z-index only via the 5 named levels `--z-chrome/overlay/modal/popover/toast` (used as `z-(--z-*)`).
- **Field grammar**: single-line controls carry their label inline (`Select`/`Input`/`NumberField`/`FontPicker` `label` prop); only multi-line or composite controls get a stacked `.field-label`.
- **Primitives first**: never hand-roll buttons/inputs/dialogs in feature code — use `src/components/ui/` (Button variants: `default`/`primary`/`ghost`/`danger`; plus Select, Textarea, SwatchButton, IconButton…). Content default colors live in `src/lib/content-defaults.ts`, never inline hex in components.
- **Guard-rails**: `npm run audit:contrast` fails if any ink/surface pair drops under 4.5:1; `npm run probe:visual` captures dark/light × empty/populated at density 2.
- Full context for design skills lives in `.impeccable.md`.

## Standards (from installed skills)

### React 19

- **No `forwardRef`** — `ref` is a regular prop in React 19. Pass it directly.
- **No inline component definitions** — never define components inside other components.
- Derive state during render, not in effects (`rerender-derived-state-no-effect`).
- Use functional `setState` for stable callbacks (`rerender-functional-setstate`).
- Use `useRef` for transient high-frequency values (mouse position, drag state) — don't trigger re-renders.
- Use `Promise.all()` for independent async operations — never sequential awaits (`async-parallel`).
- Lazy state initialization: pass a function to `useState` for expensive initial values.

### Zustand (v5+)

- Use `createStore` from `zustand/vanilla` when the store needs to be accessed outside React.
- Slice pattern: one store per domain (`canvas`, `project`, `history`, `ui`), not one mega-store.
- Subscribe to derived booleans/selectors, not raw state objects (`rerender-derived-state`).
- History store: implement undo/redo as a command stack (push snapshots, pop to restore).

### Tailwind CSS v4

- **CSS-first config** — no `tailwind.config.ts`. All theming via `@theme` in CSS.
- Define semantic color tokens in OKLCH: `--color-primary`, `--color-background`, etc.
- Dark mode via `@custom-variant dark (&:where(.dark, .dark *))`.
- Animations via `@keyframes` inside `@theme` + `--animate-*` tokens.
- Use `cn()` utility (clsx + tailwind-merge) for conditional class merging.
- Component variants via **CVA** (class-variance-authority) — not inline ternaries.
- React 19 compound components: `Card`, `CardHeader`, `CardContent`, etc. — ref as regular prop.

### UI/UX

- **Accessibility first**: contrast 4.5:1, visible focus rings, keyboard navigation, `aria-label` on icon-only buttons.
- Dense desktop chrome: controls 28-36px visual height (toolbar icon buttons 32px, panel buttons 30px, primary CTAs 36px); extend hit areas with pseudo-elements where feasible.
- Loading feedback: disable buttons during async ops, show spinner.
- Animations: 150-300ms duration, respect `prefers-reduced-motion`.
- Use Lucide React icons consistently — never emoji as icons.
- One primary CTA per screen/dialog, secondary actions visually subordinate.
- Spacing: 4px/8px incremental scale.

### Fabric.js v7

- **Named imports only** — no `fabric.*` namespace: `import { Canvas, Rect, Textbox, FabricImage } from 'fabric'`
- `fabric.Image` → `FabricImage`, `fabric.Text` → `FabricText`
- SVG loading is async: `const { objects } = await loadSVGFromURL(url)` — no callbacks
- Shadows: `obj.set('shadow', new Shadow({ ... }))` — no `setShadow()`
- Gradients: `obj.set('fill', new Gradient({ ... }))` — no `setGradient()` / `setGradientFill()`
- `colorStops` is an array of `{ offset, color }` objects, not an object map
- Use `new Point(x, y)` for `zoomToPoint()` — plain `{x, y}` won't work in TypeScript
- Prefer `canvas.toBlob()` over `toDataURL()` for large exports (avoids base64 overhead)
- Use `canvas.requestRenderAll()` over `renderAll()` for programmatic changes (batches to next frame)
- `StaticCanvas` for export rendering (no event overhead, no retina scaling)
- Multi-selection: use `ActiveSelection`, not `Group`

### Performance (Vercel Rules)

- **Bundle**: import directly from modules, avoid barrel files. Dynamic import heavy components.
- **Rendering**: use `content-visibility` for long lists. Extract static JSX outside components.
- **Canvas-specific**: Fabric.js operations are main-thread heavy — debounce/throttle resize, drag, and zoom handlers. Keep per-frame work under 16ms.
- Lazy load below-fold components (template picker, export dialog).
- Cache expensive computations at module level, not in effects.

### Export (Critical Path)

- Render at exact target resolution via `canvas.toBlob({ multiplier })` (preferred) or `toDataURL({ multiplier })` — zero upscaling.
- sRGB color space, PNG-24 (8-bit RGBA).
- Target < 5 MB per file.
- Dimensions MUST be pixel-exact — validate against `lib/dimensions.ts` constants.
- Batch export outputs a ZIP with `{dimension}/{index}_{name}.png` structure.

## Apple Dimension Constants

Primary target: **6.9" = 1320x2868** (portrait). Apple auto-scales to smaller sizes.

All accepted dimensions are in `PRD.md` under "Accepted Dimensions". The `lib/dimensions.ts` file must be the single source of truth — never hardcode dimensions elsewhere.

## Conventions

- File names: `kebab-case` for files, `PascalCase` for components.
- Store files: `{domain}.store.ts` pattern.
- Hook files: `use-{name}.ts` pattern.
- Types: centralized in `types/index.ts`, co-located types only when truly local.
- Fabric.js canvas instance: managed via `use-canvas` hook, never stored in React state (it's mutable).

## Memory Management

Project docs, memory, specs, and plans live in `aidd_docs/`.

### Project memory

<aidd_project_memory>
@aidd_docs/memory/architecture.md
@aidd_docs/memory/codebase-map.md
@aidd_docs/memory/coding-assertions.md
@aidd_docs/memory/database.md
@aidd_docs/memory/design.md
@aidd_docs/memory/forms.md
@aidd_docs/memory/navigation.md
@aidd_docs/memory/project-brief.md
@aidd_docs/memory/testing.md
@aidd_docs/memory/vcs.md
</aidd_project_memory>

- If the block above is empty, run `ls -1tr aidd_docs/memory/` and read each file.
- Load `aidd_docs/memory/external/*` when the user asks.
- Load `aidd_docs/memory/internal/*` when the task needs it.
