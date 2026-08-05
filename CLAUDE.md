# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
```

## Architecture

```
src/
  components/
    ui/                  # Design-system primitives (CVA): Button, IconButton, Input,
                         # NumberField (scrub), Slider, Segmented, Switch, Field, Dialog,
                         # Popover, Dropdown, Tooltip, Kbd, CommandPalette, ToastViewport
    canvas/              # Fabric.js canvas wrapper + interactions
    toolbar/             # Floating chrome: Toolbar (tools + export), ProjectIsland, ZoomHud
    layers-panel/        # Layer list (search, groups, DnD), memoized LayerItem
    properties-panel/    # Properties shell + sections + shared ShadowEditor
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
    toast.store.ts       # Toast queue
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

**Binary assets (v2)**: image layers and device screenshots hold a short `assetId`, never a data URL. Payloads live in `lib/assets.ts` (in-memory registry, hash-deduped) and persist in the IDB `assets` table; `storage.ts` migrates v1 inline data URLs on load.

**Granular sync (v2)**: `use-canvas.ts` diffs project references — single-screen, same-stacking-order changes take the in-place `syncPatch` path; structural changes fall back to full reconciliation.

**No object cache, no `clipPath`**: layer objects set `objectCaching = false`, and screen clipping goes through `clipContentToScreen` (a `ctx.clip()` inside a wrapped `render`), never Fabric's `clipPath` property. Both rules exist for the same reason: any object Fabric caches gets blitted back at a fractional offset with bilinear filtering, so every edge is antialiased twice — measured at 2× the soft-edge pixels on screen and in the exported PNG. Setting `clipPath` re-forces the cache via `needsItsOwnCache()` regardless of `objectCaching`.

**History coalescing (v2)**: `history.store.record(snapshot, coalesceKey)` collapses bursts (slider drags, scrubs, arrow nudges) into one undo step (1200ms window, keeps the FIRST pre-state). Panel editors pass `coalesceKey: layer:{id}:{prop}` to `updateLayer`.

## Design language (v6)

- **shadcn is the vocabulary**: `src/index.css` exposes the shadcn token contract (`background`, `card`, `popover`, `muted`, `secondary`, `accent`, `primary`, `border`, `input`, `ring`, `destructive` + `-foreground` pairs). Only 16 tokens sit outside it, for concepts shadcn has no name for: `stage`, `marker*`, `success`, `warning`, `artboard-*`, `selection-soft`, `shadow-handle`, `shadow-handle-focus`, `shadow-inset`, `hairline-top`, plus six `z-*`. Never re-theme a shadcn name to mean something else.
- **Floating islands**: the canvas is full-bleed; the top bar, the Layers/Properties drawers (⌘⇧L / ⌘⇧P), the screens filmstrip and the zoom HUD float above it. `lib/stage.ts` is the single source for chrome geometry — drawers never move the artboard.
- **The stage has a grain, not a fill**: a 22px dot grid (`stage-grain`, `--color-stage-dot`) sits behind the artboards. A flat fill gives no scale — the board floated with nothing but its own shadow to say it was resting on something. The step belongs to no closed scale (not a radius, not a control gap, not a height) so it does not owe the 4px grid; it is read in one place. The dot lightens on dark and darkens on light, stays chroma 0, and is deliberately **out** of the contrast matrix: at 5% alpha it would fail 4.5:1 by construction, and passing it would mean darkening it until it stopped being a grain.
- **Tokens**: all colors OKLCH in `src/index.css` `@theme static` (dark default + `.light`). `static` is required: the default tree-shakes to used-only, which left the `-foreground` pairs out of `:root`. True neutral, chroma 0 on every chrome surface — a colour-judgement tool must not tint what sits next to the artboard; the mockup's bluish `slate` chrome was declined on exactly this. The light theme runs on **two levels, not five**: stage 0.965, cards 1.0, and `--shadow-md` does the separating. The old 0.9 → 1.0 ramp made a grey stage on which everything floated by default, and the lighter the stage the more room a shadow has to bite.
- **One marker, for state only**: lime `--color-marker`, reserved for "you are here" — current screen, selected layer, focus ring. Not named `accent`: shadcn reserves that for the neutral hover surface. Never on an action: the Export CTA is a plain light fill. Nothing chromatic touches the artboard (`--color-artboard-ring-active` and the selection frame stay neutral).
- **Closed scales**: three type sizes (11 / 14 / 16 rendered), two line-heights (16 / 20), two control heights (32 panel, 36 top bar and modal footers), four radii derived from `--radius: 0.9375rem` (6 / 9 / 12 / 21 — the multipliers are fifths, so any upstream value that is a multiple of 5px keeps the whole chain integer), two vertical gaps (6 binds a label to its control, 8 separates controls and sections). Adding a fifth value is the drift the guard exists to catch.
- **Line-height is px on a 4px grid, never a ratio**: a ratio renders fractional (11 × 1.3 = 14.3), so a two-line block lands on no graduation and its neighbour stops aligning. The size tokens carry the pairing, and `--leading-*: initial` removes the named ratio utilities (`leading-tight/snug/relaxed/loose`) — only the numeric ones survive, and those derive from `--spacing`, so they are multiples of 4 by construction. `leading-none` is a static Tailwind utility and stays reachable; the guard is what catches it.
- **Island geometry**: `.island` carries its own inset, `--island-padding` = `--radius-xl − --radius-md` = 9px, so "inner radius = outer − inset" holds by construction and a `rounded-md` control set against an island edge follows its curve. The inset is derived, never chosen — it is the one number in the app that is allowed off the 4px grid, because the concentric rule outranks the grid. A narrow element takes a smaller radius than the island scale: `rounded-xl` on a 46px-wide filmstrip tile is 46% of its width and makes a lozenge, so the tile takes `rounded-md`. Drawers take `.island-flush` — their header bleeds to the edge and their content carries the inset. The filmstrip is not an island and has no inset: its `FILMSTRIP_PADDING` (4) is the clearance its scroll box owes a tile's focus ring (2px stroke, 2px offset), and its top carries `THUMBNAIL_LIFT` (4) on top of that, the room the current tile needs to rise out of the row. Nothing else. `overflow-x: auto` forces the other axis, so a ring or a lift with no room for it would raise a vertical scrollbar.
- **A thumbnail shows the artboard's framing**: the filmstrip tile takes its width from `THUMBNAIL_WIDTH`, derived from `APP_STORE_TARGET`. Letting the label stretch the column cost the tile its ratio, and `object-cover` then cropped 21% of every preview. Nothing in the strip may hardcode a dimension — to widen a tile, raise `THUMBNAIL_HEIGHT` and let the width follow. It sits at 116 (→ 53 wide): 124 was measured against it and bought one character of label for 8px of strip.
- **The label row appears only when it has something to say**: `screenHasCustomName` is the single place that decides, and `Écran 3` is not a name — it is the rank spelled out, which the badge already carries. One renamed screen reserves the row for all ten, so the file does not jump by 22px per rename, but only screens with a chosen name write in it. Renaming a screen *back* to its factory name makes it anonymous again: the text decides, not who typed it. The row changes the strip's height, so `stageInsets` takes `labelled` and the viewport recenters on the transition, exactly as it does when a drawer opens. Drawers cap their height on `STAGE_BOTTOM_INSET_MAX` instead, since a drawer 22px short is invisible and a drawer 22px long covers the strip. At ten screens the strip needs 699px and scrolls below a ~1020px window, which is accepted.
- **The filmstrip has no surface of its own**: unlike the top bar and the drawers it carries no island, no tray, no card. It carries previews, and a preview is already a surface — a container around them stacked strip, tile and preview at three neighbouring lightnesses and spent 26px of canvas framing empty space. The tiles are what floats; the strip is only their scroll box. The light ramp was re-pitched to two levels since — stage 0.965, cards 1.0 — which makes a tray less separable than before, not more.
- **A screen tile is one object: the number sits on the preview, and only the current one wears the marker**: the tile *is* the button, and the number is a badge inside it. Under the preview the badge had to hold against two themes and against a capture that is almost always light, and its row cost the canvas 26px; on the image it has one surface to contrast, and its own veil supplies it — `black/60` with a white digit, 5.7:1 on a white preview and 21:1 on a black one, a deliberate literal because it lands on the user's content and not on chrome (same rationale as `border-white` on the gradient stop and `SELECTION_INK`). No contact shadow: a mark laid on the image does not detach from it. State is the badge turning `marker-fill` plus a `THUMBNAIL_LIFT` (4) rise out of the row and one step up the shadow scale, never a ring: the old 2px `--color-marker` halo on a 46px-wide tile was the thickest stroke in the app and read as a highlighter. The marker is only ever on the current screen — drawn under all ten it stopped being a state and became an ornament. The lift is what carries the state in dark theme, where a shadow step is close to invisible; under `prefers-reduced-motion` it drops and the badge plus the shadow carry it alone. The label is the rank, not a zero-padded matricule: `01` reads as a code where one glyph is read at a glance. `THUMBNAIL_BADGE_SIZE` (16) is the box's floor, not its width — the project caps at ten screens, and a fixed 16 left `10` touching both edges. The actions handle keeps a 28px hit box, not `hit-44`: on a 46×100 tile a 44 square covered 42% of the preview and took the click meant for the screen, and the full action set is already on the tile's right-click.
- **Reordering is shown, not promised**: dragging a tile parts the row by one `THUMBNAIL_SLOT` and hides the dragged tile, so the strip already holds the shape it will have on drop. Native HTML5 drag, no library: the browser draws the item under the cursor, and the shift always vacates the slot the pointer is over, so `dragover` cannot oscillate between two tiles. `FILMSTRIP_GAP` is declared in `lib/stage.ts` rather than left to `gap-2` because the layout and the shift must read the same number. A single lime bar sits in the vacated slot — the shift states the final arrangement, the bar states the insertion point, and the two differ when the opening is at the strip's edge or off screen. It is the one place the marker appears twice at once, and it is transient. `pointer-events-none` on it is a condition, not a precaution: it lies exactly where the cursor is, and would otherwise steal the `dragover` that picks the target.
- **A declared floor beats a silent one**: the editor is desktop-class and says so. `lib/stage.ts` derives three widths from the same chrome constants — `DUAL_DRAWER_MIN_WIDTH` (below it drawers open one at a time, `setExclusiveDrawers` closing Layers and keeping the editing surface), `TOP_BAR_COMPACT_WIDTH` (below it the secondary actions fold into one overflow menu, Export never folds), and `MIN_APP_WIDTH` (below it the app states its minimum instead of rendering). Measured before these existed: at 560px Export left the viewport, at 375px six controls did and the drawers overlapped by 249px, with nothing said. Read them through `useMediaQuery`, never a hardcoded breakpoint.
- **Type**: Inter variable (UI, `index.html`), 14px body, tabular figures for numeric fields. No all-caps labels. Content fonts (text layers) load on demand.
- **Two surfaces, never three**: an island carries its controls directly. A panel section is a band — a `border-t` hairline plus the header's own top padding — never a recessed card, which would put the island, the card and the field on three levels and cost every field 18px of width. `surface-inner` survives only inside a modal.
- **A handle's elevation is a token**: `--shadow-handle` is the contact shadow of anything you grab (slider thumb, gradient stop) and `--shadow-handle-focus` the ring it takes under keyboard focus and while dragging. Both lived inline in two components at two different alphas — a difference nobody decided. A handle is not an island: it does not float on the three-layer `shadow-md/lg/xl` scale, it detaches from the surface it touches. Consume them as `shadow-(--shadow-handle)`, never as a literal `oklch()`. The one deliberate literal left is `border-white` on the gradient stop: it sits on the user's own gradient, not on chrome, so a themed ring would vanish on a dark stop in dark theme — same rationale as `SELECTION_INK`.
- **Field grammar**: single-line controls carry their label inline (`Select`/`Input`/`NumberField`/`FontPicker` `label` prop); only multi-line or composite controls get a stacked `.field-label` — including sliders (`Slider` `label` prop), unless the row they sit in already names them.
- **The hierarchy is declared, not only painted**: `panel-title` is an `<h2>`, `section-title` an `<h3>`, and a collapsible panel section is the APG shape — an `<h3>` carrying its `aria-expanded` button. The panels are `<aside aria-labelledby>`, the top bar a `<header>`, and an `sr-only` `<h1>` anchors the document. Before this the app rendered zero heading elements: the structure existed for the eye only, and heading navigation returned nothing.
- **A layer is named by what it says**: `layerDisplayName` shows a text layer's content until the user renames it, in the list, the filter, the context menus and the accessible name. A column of "Texte" describes nothing.
- **Primitives first**: never hand-roll buttons/inputs/dialogs/scroll areas in feature code — use `src/components/ui/` (CVA variants). Content default colors live in `src/lib/content-defaults.ts`, never inline hex in components.
- **Guard-rails**: `pnpm run audit:contrast` fails if any ink/surface pair drops under 4.5:1, plus the closed pairs an ink×surface matrix cannot express (`marker-ink` on `marker`, measured 11.47:1) — the lime and its ink previously lived on a ratio asserted in a comment and checked by nobody; `pnpm run audit:scale` fails if the rendered type, height, radius or gap scales open up, or if any rendered line-height leaves the 4px grid, naming the offending elements; `pnpm run probe:visual` captures dark/light × empty/populated.
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
- Touch targets: min 44x44px, 8px+ spacing between interactive elements.
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
