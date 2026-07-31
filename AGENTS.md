# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

**ScreenForge** — Local-first web app for designing and exporting iPhone App Store screenshots. Replaces paid tools like AppScreens.com. Zero backend, zero recurring cost.

See `PRD.md` for full spec. Key constraint: exported PNGs must be pixel-exact (1320x2868 for 6.9", etc.) and pass App Store Connect validation.

## Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Build | Vite | latest |
| UI | React + TypeScript | React 19 |
| Canvas | Fabric.js | v7 |
| State | Zustand | v5+ |
| Styling | Tailwind CSS | v4 (CSS-first config) |
| Storage | IndexedDB via `idb` | — |
| Fonts | Google Fonts API | on-demand |
| Icons | Lucide React | — |
| Export | Fabric.js `toDataURL({ multiplier })` / `toBlob()` + JSZip | — |

## Commands

```bash
# Dev
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Type check
npm run typecheck

# E2E tests (Playwright, requires chromium — `npx playwright install chromium` once)
npm run test:e2e

# Validate an exported ZIP against App Store rules
npm run validate:export -- <file.zip>
```

## Testing

- E2E specs live in `e2e/`, driven through the real UI (French aria labels) plus two dev-only debug handles: `window.__sfCanvas` (Fabric instance, exposed by `use-canvas`) and `window.__sfStores` (Zustand stores, exposed by `main.tsx`), both only when `import.meta.env.DEV`.
- Transform specs assert the canvas → store → sync round-trip does not move objects after mouse release — the historical "drifting handles" bug class. Panel inputs are located by aria-label ("Position X", "Largeur", "Rotation"…), never positionally.
- `e2e/export.spec.ts` verifies the exported ZIP is pixel-exact (1320×2868, PNG-24 opaque) — the critical path.
- `e2e/command-palette.spec.ts` covers the ⌘K palette and history coalescing (nudge burst = one undo step).
- `scripts/visual-probe.mjs` screenshots the app for design review; `scripts/export-probe.mjs` drives a real export end-to-end and validates the ZIP (requires the dev server on :5199).

## Architecture

```
src/
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

**Granular sync (v2)**: `use-canvas.ts` diffs project references (`diffProjectChange`) — single-screen, same-stacking-order changes take the in-place `syncPatch` path (no clipPath/z-order rebuild); structural changes fall back to full reconciliation.

**History coalescing (v2)**: `history.store.record(snapshot, coalesceKey)` collapses bursts (slider drags, scrubs, arrow nudges) into one undo step (1200ms window, keeps the FIRST pre-state). Panel editors pass `coalesceKey: layer:{id}:{prop}` to `updateLayer`.

## Design language (v3)

- **Réduction maximale**: the canvas is full-bleed; a single top bar (`TopBar`, h-11) holds project identity, tools and the Export CTA. Layers/Properties are overlay **drawers** (⌘⇧L / ⌘⇧P, Escape closes them before deselecting) — `lib/stage.ts` is the single source for chrome geometry; `stageInsets()` reserves only bar, filmstrip and margins (drawers never move the artboard).
- **Monochrome**: all colors OKLCH in `src/index.css` `@theme` (dark default + `.light`). Warm graphite near-neutral; accent is white (`foreground`); red `#d71921` (`export` tokens) is reserved for the Export CTA only — active/selected states are always neutral (`border-foreground-muted`, `bg-surface-active`). Focus ring is neutral, no blue anywhere.
- **Type**: Geist (UI) + Geist Mono (tabular values), loaded via `index.html`. Labels are `.caps-label` (Geist Sans caps 10px); content fonts (text layers) still load on demand.
- **Elevation & z**: islands/modals 8px radius, controls 6px; shadows only on floating surfaces; z-index only via the 5 named levels `--z-chrome/overlay/modal/popover/toast` (used as `z-(--z-*)`).
- **Primitives first**: never hand-roll buttons/inputs/dialogs in feature code — use `src/components/ui/` (Button variants: `default`/`primary`/`export`/`ghost`/`danger`; plus Select, Textarea, SwatchButton, IconButton…). Content default colors live in `src/lib/content-defaults.ts`, never inline hex in components.
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
