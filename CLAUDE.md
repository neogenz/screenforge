# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ScreenForge** — Local-first web app for designing and exporting iPhone App Store screenshots. Replaces paid tools like AppScreens.com. Zero backend, zero recurring cost.

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

Toujours depuis la racine : les scripts racine délèguent au paquet concerné
(`pnpm --filter web …`), et les audits de `scripts/` résolvent leurs chemins
depuis la racine.

```bash
# Dev
pnpm run dev

# Build
pnpm run build

# Preview production build
pnpm run preview

# Lint
pnpm run lint

# Type check
pnpm run typecheck

# Stack Supabase local (Docker), ports 544xx
pnpm run db:start
pnpm run db:migrate
pnpm run db:stop
```

## Architecture

Espace de travail pnpm : la racine ne porte que l'outillage (scripts d'audit,
eslint, prettier, husky, `supabase/`), le produit vit dans `apps/*`. Voir
`AGENTS.md` pour l'arborescence de la racine.

```
apps/web/src/
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
    vector-picker/       # Shape + icon catalogue picker
    refresh-dialog/      # Batch screenshot refresh (slot mapping, preview, all-or-nothing)
    release-dialog/      # Freeze a release, verify it, diff it against the live project
    locale-dialog/       # Locale variants + overflow review
    campaign-dialog/     # AI brief → validated plan → real layers
    publish-dialog/      # asc preflight, bundle + manifest, bridge publish
    auth-dialog/         # Sign in (optional Cloud)
    account-dialog/      # Account, entitlements, deletion
    pricing-dialog/      # Offers
    migrate-dialog/      # Local projects → Cloud
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
    stage.ts             # Floating-chrome insets, responsive thresholds (never hardcode one)
    editor-transaction.ts# All-or-nothing mutation + one undo step (every write goes through it)
    project-validation.ts# Strict project contract + pure migrations, at every boundary
    slots.ts             # Semantic screen roles
    screenshot-placement.ts # Persistent crop (mode, focus, zoom) — survives asset swaps
    batch-refresh.ts     # Slot mapping + atomic screenshot batch
    vector-catalog.ts    # Shape + icon paths (serialisable ids, no React in the model)
    text-styles.ts       # Per-passage text colour (Fabric's char-style index, made portable)
    release.ts           # Batch render, immutable Release, structural diff, verification, restore
    locale.ts            # Locale variants, text measurement, overflow findings
    asc.ts               # App Store locales, export tree, manifest, preflight
    bridge-client.ts     # Local bridge, one token per capability (codex, asc-publish)
    ai/                  # Provider registry, constrained plan schema, deterministic builder
    hash.ts              # sha256 for assets, release files, bundles
    image.ts / number.ts # Shared image + numeric helpers
    utils.ts             # cn() helper (clsx + tailwind-merge)
  types/
    index.ts             # Layer, Screen, Project, ExportConfig types
```

**Key data flow**: Zustand stores are the single source of truth. The Fabric.js canvas syncs bidirectionally with `canvas.store.ts`. User edits on canvas -> store update -> properties panel reflects. Properties panel edit -> store update -> canvas re-renders.

**Binary assets (v2)**: image layers and device screenshots hold a short `assetId`, never a data URL. Payloads live in `lib/assets.ts` (in-memory registry, hash-deduped) and persist in the IDB `assets` table; `storage.ts` migrates v1 inline data URLs on load.

**Granular sync (v2)**: `use-canvas.ts` diffs project references — single-screen, same-stacking-order changes take the in-place `syncPatch` path; structural changes fall back to full reconciliation.

**A layer's coordinates are scene coordinates, until it is selected with others**: `left`/`top` read in the parent's plane, and Fabric re-parents objects into an `ActiveSelection` the moment a lasso closes over them. `applyLayerToFabricObject` is the one place that writes geometry, and it places through `setXY` whenever the object has a group. Measured before that: lassoing three layers of a screen that was not the current one switched the current screen, which forced a full sync, which re-laid those three layers 1182px away — outside their clip, so invisible, with nothing in the project having moved. The wrong position became real on the next `object:modified`, which reads the matrix. Arrow-nudging a multi-selection took the same path through `patchCanvas`, once per keypress.

**Nothing is written to the project while a gesture is still running**: Option-dragging a layer duplicates it, and the whole feature is one branch at the top of `object:modified` — not a clone dropped on the canvas at mousedown. Adding a layer changes a screen's layer count, which `diffProjectChange` classifies as `full`, and a full reconciliation rebuilds every Fabric object, including the one the pointer is currently holding. So the drag runs to its end untouched; then the copy is written at the dropped geometry and the original is simply not written at all, and the sync that follows puts the dragged object back where its layer stayed while the copy appears under the cursor. Both being identical, nothing jumps. The modifier is read at the drop, from `object:modified`'s own event, the way the Finder reads it — pressing or releasing Option mid-gesture is therefore free, and no state is armed at mousedown. It is restricted to `event.action === 'drag'` because Fabric already spends `altKey` on centred scaling, and a layout layer is excluded: it is shared by every screen already, so a mixed selection moves rather than half-duplicating. `canvas.moveCursor` is the only feedback the gesture can give, since by construction nothing else has happened yet — Fabric re-reads it on every move.

**No object cache, no `clipPath`**: layer objects set `objectCaching = false`, and screen clipping goes through `clipContentToScreen` (a `ctx.clip()` inside a wrapped `render`), never Fabric's `clipPath` property. Both rules exist for the same reason: any object Fabric caches gets blitted back at a fractional offset with bilinear filtering, so every edge is antialiased twice — measured at 2× the soft-edge pixels on screen and in the exported PNG. Setting `clipPath` re-forces the cache via `needsItsOwnCache()` regardless of `objectCaching`.

**A board shows only what belongs to it; what leaves lands on the stage, dimmed, and is no longer grabbable there**: one rule, three consequences, and `clipContentToScreen` paints the two halves of it — crisp inside the board's rect, then, only if `escapesScreen`, a second pass at `OFFBOARD_OPACITY` (0.25) clipped to the complement of **every** board. The complement and not just its own: measured on the live canvas, all N backgrounds occupy indices 0…N-1 and every layer comes after, so there is no side on which paint order would save a ghost from covering its neighbour — and `install-thumbnails` does one `renderAll()` then crops board by board, so a ghost over a neighbour would be baked into that neighbour's preview. One clip holds both, with no render-mode flag to raise and lower. The fade rides on `this.opacity`, never `ctx.globalAlpha`: Fabric's `_setOpacity` **overwrites** the context alpha the moment an object has a group whose transform is running, which is exactly a multi-selection mid-drag. Before any of it, a layer dropped off its board was invisible everywhere and still clickable **over the neighbouring board**, where it stole the click meant for that board's own layer — so `applyScreenPresence` also drops `selectable` and `evented` together, `evented` for the click (`_checkTarget`) and `selectable` for the lasso (`collectObjects`, which ignores `evented`). It is applied on the patch path too, or the next arrow-nudge would silently hand the grab back. Two thresholds, not one: `escapesScreen` (any overflow) lights the ghost, `intersectsScreen` (less than 8px of overlap left) takes the grab — a composition that deliberately bleeds off the edge stays visible and editable on its board. The ghost alone is not a signal you can rely on, and that is measured: it is painted with the layer's own ink but on the stage rather than on the board that gave it its ground, so a near-black headline dimmed to a quarter composites at **1.05:1** on the dark stage, and a white one would do the same on the light stage — visibility would depend on the project's colours and the app's theme. So losing the grab, and only that, adds a dashed two-tone frame (`SELECTION_INK` on `SELECTION_HALO`, the pair that reads on any ground, which is why the selection already uses it). Losing the grab would otherwise be a dead end, so `TransformSection` reads `layerOutOfReach` — the same threshold, on the declared box the X and Y fields show — and offers "Ramener sur la planche", one `clampLayerToBoard` through `updateLayer`, one undo step.

**History coalescing (v2)**: `history.store.record(snapshot, coalesceKey)` collapses bursts (slider drags, scrubs, arrow nudges) into one undo step (1200ms window, keeps the FIRST pre-state). Panel editors pass `coalesceKey: layer:{id}:{prop}` to `updateLayer`.

**One write path, all or nothing**: every _multi-step_ mutation goes through `runEditorTransaction(mutate, coalesceKey?)` — it validates the candidate project, commits it or discards it whole, and records exactly one undo step. This is what lets a ten-screenshot batch, an AI plan or a locale substitution be a single operation rather than ten partial ones. Never split one user gesture across two transactions: a failed run must leave nothing behind. The invariant is a file list, not a slogan: `useProjectStore.setState` is called from exactly **three** modules, and `grep -rn 'useProjectStore.setState' apps/web/src` is how you check it. `lib/editor-transaction.ts` is the transaction itself. `stores/canvas.store.ts` is the single-property editor path (`addLayer`/`updateLayer`/`removeLayer`, see the coalescing note above). `hooks/use-canvas.ts` is the canvas writing back what the user just drew on it — `object:modified` commits the geometry Fabric produced, after recording its own history step, and the thumbnail pass writes `screen.thumbnail`, which is render output and deliberately carries no undo step. A fourth caller is the defect: a feature module reaching into the store bypasses validation, history and coalescing at once.

**A release is frozen, not followed**: `Release` carries a deep-cloned snapshot, the rendered files with their sha256, and the locale it was rendered in. The project keeps changing next to it; the release does not. Verification re-renders the snapshot and compares hashes, and publication consumes a release — never the live project. **Verification is not the gate; it is a dry run of one.** `PublishDialog.prepare` re-renders and re-hashes on its own and refuses anything drifted, so "Vérifier" changes nothing about what can be sent — it answers, before you go near Apple or the bridge, whether the machine can still build this lot: a Google font that no longer loads, a device frame an update replaced, a screenshot lost from IndexedDB. That distinction has to stay in the copy, because a button that looks like a mandatory step with no visible effect is what made the whole feature unreadable to its first user. Anything that made a release track the project would erase the one dated fact the whole cycle rests on. The copy runs one way and on demand: `restoreRelease` writes a release's snapshot back into the project as a single transaction, so a frozen lot can be resumed. Nothing writes in the other direction — a release is never updated from the project, only replaced by a new one.

**Nothing leaves the machine unless it is asked to**: the default AI provider is the local deterministic builder. The bridge is optional, is two capabilities with two separate tokens (`assistant` never receives an image; `asc-publish` sends a frozen bundle to Apple), and ScreenForge holds no App Store credential at any point — `asc` resolves its own from the system keychain. Adding a field for a `.p8`, an issuer id or an API key would break the phase-9 contract. The bridge never fetches a URL either: `landingUrl` is quoted to the model as context and read by nobody else, since a `fetch` on an address supplied by the page would make the bridge an outbound relay on a machine it is meant to expose only to the assistant it launches.

**The default path is not an AI, and the interface says so first**: `providers.ts` names the local builder "ScreenForge seul, sans IA" and states in the same breath what it costs — the headlines are the screenshot filenames, to be rewritten. The dialog is `Générer les visuels App Store` (a megaphone, not a wand), its steps are numbered, and the provider row is titled by what it changes for the user ("Qui écrit les accroches") rather than by the transport. Every one of those replaced a word that was true and unread: "Composer une campagne" under a magic wand, "Assistance / Composition locale", "planche". Measured on the user: they could not tell whether the dialog created a campaign, generated one screen or restyled the current one, and they read the wand as an AI retouch of the selected layer. An interface that promises a model over a deterministic template is paid for twice — once at the first try, then in trust.

**How many visuals is a decision, not a consequence**: `CampaignBrief.screenCount` commands the plan; the screenshots only fill the devices, in order. Nobody has ten captures ready when they start a listing, and a builder that emitted one board per file made the count un-choosable — it also made "no screenshots" mean "one empty board". Boards past the last capture are laid out complete and left with an empty device, which `batch-refresh` fills later. The bridge clamps the model's answer to **both** bounds, the project's ten and the number asked for. The dialog offers the room the project actually has, `maxScreens − project.screens.length`, not the absolute ten: `add_screen` refuses the moment a project holds ten screens and a fresh project already ships with one, so the list offered "10 visuels" where ten was impossible and the whole reviewed lot was discarded at the final click on "Campagne pleine". A ceiling is read before choosing, not after re-reading. It is derived during render rather than mirrored into state, so a project that gains a screen while the dialog is open narrows the list; at ten the count field is replaced by one sentence and "Proposer" is disabled, because the dialog's other half — repainting the current screen to the chosen style — still works there.

**The art direction is read, not guessed**: `lib/ai/palette.ts` samples the uploaded screenshots (24×24 per file, 4-bit buckets) and yields background, ink and accent — offered as a fifth style, "D'après mes captures". It is done in the tab and not by a model on purpose: the bridge sends no image, so any model asked for the app's palette would invent a plausible one. The ink is _chosen_ against the extracted background rather than sampled, because a sampled ink landed at 1.4:1 on it; the accent needs both chroma and a luminance gap, and a greyscale capture yields none — the function returns the ink there rather than a colour nobody can see. The resolved triplet rides on `CampaignPlan.palette`, never re-derived from `direction` downstream: re-reading the preset repainted a validated custom palette back to "Sobre" between the review and the commit.

**A set is six compositions on a rota, never one composition six times**: `lib/ai/archetypes.ts` is a table — fractions of a 440×956 board, not sentences — and `assignArchetypes(count)` decides which board gets which. Rank 0 always takes `plein-cadre` (the only visual most people will ever see); from four boards up the last takes `mur`, which carries no device at all; the rest cycle through four, which mechanically guarantees that no two neighbours match and that three boards already use three archetypes. A cycle and not a draw: two identical sets must render identically, or the review proves nothing about what "Ajouter" will lay down. What existed before was one composition applied to all ten boards — headline on top, device centred, near-white flat fill — in the function whose entire promise is composing an App Store listing. The reference is Shotluma and it is taken **inverted**: there the archetypes are prose in a prompt, a model picks free coordinates, and a loop measures the rendered DOM and hands the defects back. Here the doctrine is the opposite and does not move — the model writes the words, the repo writes the layers — so the archetypes are data and the quality rules a model re-reads in an image become assertions in `archetypes.test.ts`: no two neighbours alike, three distinct from three boards up, no empty band a quarter of the board tall, at least 70% of a device on the board (checked against every frame's real aspect ratio, not a plausible one), and a headline at 4.5:1 on every stop of its own background. Shotluma's GIANT CROP ranges were recalculated, not copied: it has wide low-angle renders (aspect 1.11) that a 130%-width crop can overflow without decapitating; ScreenForge has only upright frames (aspect 0.46), where the same instruction yields a device 2.8× the board's height. The tool vocabulary had to grow for any of it to be expressible — `rotation` and `opacity` on every `add_*`, `centerX`/`centerY` on backgrounds — because a deterministic plan builds all its calls before the first one runs and therefore has no layer id to patch afterwards. That gap is _why_ the generator could only emit flat identical boards. A headline box's height is **derived** from its own font size — `lines × fontSize × 1.2`, the exact formula `locale.ts` measures with — never declared as a fraction of the board: a 143px box announced beside a 50px body held two lines, and the third overflowed. Nothing in the campaign path caught it; the locale review did, on the source language, before any translation.

**The fond belongs to the composition, so no model is asked for one**: `backgroundFor(archetype, palette)` is the single origin, and it is called by all three planners — local, bridge, direct API. None of the four recipes renders the palette's bare flat colour ("be confident — a saturated brand colour or a rich dark tone as a full-bleed background almost always beats a timid neutral"), and `composeArchetype` receives the resolved background rather than re-deriving it, so the ink is chosen against what is actually painted. The remote protocols lost the field entirely: `PLAN_OUTPUT_SCHEMA` no longer declares `background`, `plannedScreenSchema` no longer accepts it, and the prompt that asked for "a hex consistent with the imposed style, identical on every visual barring a compositional reason" is gone — a instruction that could only produce ten identical flats, followed by a hand-written hex to validate. A field whose right answer is known in advance has nothing to do in a protocol; it only adds a way to be wrong. `PlannedScreen` lost it too, for the same reason one rung down: `planScreenLayout` resolves the fond at every read, from the rank, so a plan that also carried one held two truths and the second aged the instant a board was dropped from the review — removing the second of four re-ran the rota and left the "carte" board painted on the wall's full-bleed accent, its ring invisible on it. A background does not survive the rank that chose it. `planToolCalls` emits `layout.background`, and `ai-builder.test.ts` compares its `set_background` calls board by board against what `planScreenLayout` returns, since the two readers had already drifted once. `restyleCalls` follows the same rule and compares backgrounds by `backgroundToCss` rather than by shape, since two objects with the same colours in a different key order are the same fond. What it still cannot know: whether a shape serves the composition (the legibility pill under a headline laid over a device) or is ornament — it repaints them all to the accent, which is the promise on a screen the user composed and a colour change under their own text on a generated one.

**The review shows the boards, and one function decides where things go**: `planScreenLayout` in `lib/ai/plan.ts` returns the background, the headline box, the device box, and the two accent lists — behind and in front, two lists and not one because paint order is the information — for one board, and both `planToolCalls` and `PlanPreview` read it. That shared call is what makes the preview opposable — it cannot show a composition the commit would not produce, because it is not describing the layout, it is the layout. The preview is drawn in CSS and not by Fabric: a `StaticCanvas` per board would render ten 1320×2868 canvases on every keystroke in the headline field, for a picture 132px wide. It deliberately omits the iPhone chrome, which has nothing to say at that scale, and renders the headline at its true scaled size — two pixels tall, unreadable, and correct: the shape of the text block is the information, the words are re-read in the field beside it. Nothing the preview rotates declares a `transform-origin`, because Fabric rotates about the centre and so does CSS by default. `FabricObject.ownDefaults` does set `left/top` at the top of `canvas-utils`, but `applyLayerToFabricObject` puts every object back to `center/center` 430 lines later and places it at `layer.x + width/2` — the unrotated box lands in the same place either way, only the pivot differs. Writing `transform-origin: 0 0` on the strength of the first setting put `bord-coupe`'s tilted device 38px off on a 440-wide board. An accent's `viewBox` is the path's **own** bounding box, `drawnBox(entry)`, never the catalogue's 100×100: Fabric scales a `Path` by `layer.width / object.width`, so "Ligne" — a 100×12 bar — comes out a full slab on the board where a 100-unit viewBox drew it as a five-pixel thread here. Two of the three shapes the archetypes use were in that case. `vector-catalog.ts` carries the measurement as `drawn` and `vector-catalog.spec.ts` re-reads it with a real SVG engine's `getBBox` on every run, because a hand-copied number goes stale at the first retouched path. The logo is the one thing the archetypes do not know about: it lands at `LOGO_TOP` (32) and runs to 80, while the opening board's headline starts at 43 — measured, the text was painted over the logo on the only visual most people will see. `planScreenLayout` shifts the headline and the device together by whatever clears it, so the gap between them does not move, and a board without a logo is untouched. The invariant has teeth: when the generator stopped laying ten identical boards, `PlanPreview.tsx` stopped compiling, which is the intended behaviour — a composition the preview cannot draw must not be silently layable. The review is where the plan is still free: editing a headline, dropping a board and reordering the focus cost nothing, because nothing has been written yet. Once "Ajouter" is pressed, the same corrections are undo steps on a project where ten screens already exist.

**A capability is named after what it opens, not after who answers it**: the bridge token is `assistant`, and `EngineId` (`codex` | `claude`) rides on the request beside it. Two engines, one capability, one token, one pairing — because what the user is granting is "write my headlines on this machine", and that grant does not change when the binary behind it does. The token was called `codex` and `main.ts` printed `Jeton « codex »`, which made the second engine look like a second permission to give. `runTurn(state, engine, turn)` in `server.ts` is the whole dispatch; `/hello` probes both binaries in parallel and returns `engines: EngineStatus[]`, so the page learns what is installed without asking for anything. Claude Code answers through `--print … --output-format json`, in `tmpdir()` so no `CLAUDE.md` is discovered, with the whole tool set denied and a `--system-prompt` that replaces Claude Code's own — measured, that replacement drops the turn from 54k to 36k cached tokens, and a plan does not need the agent harness. `--bare` was tried and rejected: it forces `ANTHROPIC_API_KEY` and never reads the user's OAuth session, which is the one thing this path exists to reuse. Claude Code publishes no model catalogue, so `CLAUDE_MODELS` declares the aliases its own `--help` names, and `/models?engine=claude` answers without waking Codex.

**The setup starts with what can be constated, not with what must be pasted**: `AssistantSetup.tsx` renders three numbered steps from the provider's own `setup` block, and the first one is a state the page reads by itself — `probeBridge()` calls `/hello` with no token, so "le pont ne tourne pas" is written before anything is typed. Until it is up, the token field and its button stay disabled: pasting a secret into a bridge that is not listening can only produce a failure, and the previous screen made that failure the way you learned the bridge was off. It was one paragraph of instructions and one field, and the field was the only thing that looked actionable. The command is a copy button, not a sentence to retype; "Vérifier" re-reads the state instead of asking for a reload. A provider with `auth !== 'none'` and no `setup` is a test failure, so the marche à suivre cannot be forgotten when a provider is added. The probe is tagged with the provider it was run for and read during render — a `setState` in an effect to show "checking" is what `react-hooks/set-state-in-effect` catches, and switching provider mid-probe would otherwise show the wrong engine's verdict.

**A pairing outlives the dialog, and a key outlives the tab — each by exactly as much as it is still true for**: `lib/ai/session.ts` holds the pairing (provider, secret, connection, model) and `CampaignDialog` reads it on mount and writes it back from one effect. It had lived in the dialog's own `useState`, so the scope was the dialog, not the session: generating closes the dialog, which meant every single generation cost you relaunching the bridge, re-pasting the token and re-picking the model. `lib/ai/key-store.ts` is the second horizon: an API key is sealed with AES-GCM under a key the browser generates `extractable: false`, in a database deliberately separate from `screenforge`, so nothing here can ride along in a project export or a Cloud sync. What that stops is a reader of the browser profile — a Time Machine backup, a synced folder, another account on the machine. What it does not stop, and no browser storage does, is a script running on this origin: it does not need to read the sealing key, it can just call `decrypt()`. There is no vault in a tab; there is encryption at rest, and the interface says that much and no more. Three things stay out of it by rule, and each for a different reason: the bridge token, which dies with its process and would be false at the next restart; the connection state and its model catalogue, which are the result of a request and not a setting — restoring them would print "connected" over a key revoked since; and any auto-connect, because an outgoing request triggered by merely opening a window is a surprise. So reopening offers the key and the model and leaves the click. `rememberOnDisk` seals **before** re-reading the vault, since the first seal is what generates and stores the sealing key — reading first would write back a version without it, and everything would work until the next reload, when the ciphertext no longer opened. `forgetStoredSecret` is the only way back out; a persistence with no erase path is a one-way door. `connectApiProvider` validates by fetching `/models`, which costs no token and populates the third step at the same time; a catalogue past `BROWSABLE_MODELS` (40) switches the control from a `Select` to an `Input` + `<datalist>`, since OpenRouter's three hundred entries are searched, not scrolled. The model may write the words and nothing else: `planViaApi` forces back `appName`, `direction`, `palette`, `deviceModel`, composes each fond from the board's rank, clamps the screen count to both bounds, and drops a `screenshotIndex` that designates no asset. Anthropic is called with the browser-access header it requires; OpenRouter only receives `HTTP-Referer` when there is a real origin to send.

**The bridge's source is run, not built**: `apps/bridge` starts with `node src/main.ts`, and Node's TypeScript support is strip-only — it erases types without rewriting anything. Constructor parameter properties (`constructor(private readonly cmd = …)`) are the one common syntax that needs a rewrite, so `codex.ts` declares its fields and assigns them in the body. This was not theoretical: `pnpm --filter bridge run start`, the exact command the setup screen gives you to copy, died on `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` — the bridge could not start at all, and no test noticed because the suite imports the modules through Vitest, which compiles them properly. Anything added to `apps/bridge/src` must survive `node` reading it directly; running the binary once is the only check that covers it.

**A refused origin and a closed port are the same event in a browser**: the bridge answers a disallowed `Origin` with a 403 before it writes any CORS header, so the browser withholds the response entirely and `fetch` rejects with the same `TypeError` as a port nobody is listening on. Nothing client-side can tell them apart, which is why `DEFAULT_ORIGINS` has to be right rather than merely defensible and why `UNREACHABLE` names both causes and points at the origin list the bridge prints when it starts. It listed 5199 (Playwright) and 4173 (`vite preview`) and not 5173, which is the port `pnpm run dev` serves on — every port ScreenForge is developed against except the one it is developed on. `bridgeReachable` only reads the hostname, so the page offered the provider, accepted a token, and answered "lancez-le" to someone whose bridge was running in the next window. The e2e spec that asserts the down state used to assume no bridge was running on the machine; it now aborts the route itself, because the machine that runs this suite is exactly the one where somebody is working on the bridge.

## Design language (v6)

- **shadcn is the vocabulary**: `src/index.css` exposes the shadcn token contract (`background`, `card`, `popover`, `muted`, `secondary`, `accent`, `primary`, `border`, `input`, `ring`, `destructive` + `-foreground` pairs). Only 16 tokens sit outside it, for concepts shadcn has no name for: `stage`, `marker*`, `success`, `warning`, `artboard-*`, `selection-soft`, `shadow-handle`, `shadow-handle-focus`, `shadow-inset`, `hairline-top`, plus six `z-*`. Never re-theme a shadcn name to mean something else.
- **Floating islands**: the canvas is full-bleed; the top bar, the Layers/Properties drawers (⌘⇧L / ⌘⇧P), the screens filmstrip and the zoom HUD float above it. `lib/stage.ts` is the single source for chrome geometry — drawers never move the artboard.
- **The stage has a grain, not a fill**: a 22px dot grid (`stage-grain`, `--color-stage-dot`) sits behind the artboards. A flat fill gives no scale — the board floated with nothing but its own shadow to say it was resting on something. The step belongs to no closed scale (not a radius, not a control gap, not a height) so it does not owe the 4px grid; it is read in one place. The dot lightens on dark and darkens on light, stays chroma 0, and is deliberately **out** of the contrast matrix: at 5% alpha it would fail 4.5:1 by construction, and passing it would mean darkening it until it stopped being a grain.
- **Tokens**: all colors OKLCH in `src/index.css` `@theme static` (dark default + `.light`). `static` is required: the default tree-shakes to used-only, which left the `-foreground` pairs out of `:root`. True neutral, chroma 0 on every chrome surface — a colour-judgement tool must not tint what sits next to the artboard; the mockup's bluish `slate` chrome was declined on exactly this. The light theme runs on **two levels, not five**: stage 0.965, cards 1.0, and `--shadow-md` does the separating. The old 0.9 → 1.0 ramp made a grey stage on which everything floated by default, and the lighter the stage the more room a shadow has to bite.
- **One marker, for state only**: lime `--color-marker`, reserved for "you are here" — current screen, selected layer, focus ring. Not named `accent`: shadcn reserves that for the neutral hover surface. Never on an action: the Export CTA is a plain light fill. Nothing chromatic touches the artboard (`--color-artboard-ring` and the selection frame stay neutral).
- **On the board, the current screen is the one that floats**: not the one wearing a ring. `--color-artboard-ring-active` is gone. A stroke sits _on_ the artboard's edge, and Fabric paints the layers after the background, so the first device mockup that reached the edge covered it — the ring then read as a broken frame, which is what the user's capture showed. A shadow is _under_ the board: nothing the user puts on it can cross it, and it costs the framing no pixel. So the ring is uniform 1px everywhere and purely structural (it says where a white board ends on a near-white stage), while the state is `artboardStyle` in `canvas-interactions.ts` — blur 56/offset 18 for the current board against blur 12/offset 2 for the others, plus the label above it going from `muted-foreground` to `foreground`. Both cues live outside the artwork and stay achromatic. One function owns it because two call sites read it (the sync pass and the theme pass) and they had already drifted apart once.
- **Closed scales**: three type sizes (11 / 14 / 16 rendered), two line-heights (16 / 20), two control heights (32 panel, 36 top bar and modal footers), four radii derived from `--radius: 0.9375rem` (6 / 9 / 12 / 21 — the multipliers are fifths, so any upstream value that is a multiple of 5px keeps the whole chain integer), two vertical gaps (6 binds a label to its control, 8 separates controls and sections). Adding a fifth value is the drift the guard exists to catch.
- **Line-height is px on a 4px grid, never a ratio**: a ratio renders fractional (11 × 1.3 = 14.3), so a two-line block lands on no graduation and its neighbour stops aligning. The size tokens carry the pairing, and `--leading-*: initial` removes the named ratio utilities (`leading-tight/snug/relaxed/loose`) — only the numeric ones survive, and those derive from `--spacing`, so they are multiples of 4 by construction. `leading-none` is a static Tailwind utility and stays reachable; the guard is what catches it.
- **Island geometry**: `.island` carries its own inset, `--island-padding` = `--radius-xl − --radius-md` = 9px, so "inner radius = outer − inset" holds by construction and a `rounded-md` control set against an island edge follows its curve. The inset is derived, never chosen — it is the one number in the app that is allowed off the 4px grid, because the concentric rule outranks the grid. A narrow element takes a smaller radius than the island scale: `rounded-xl` on a 46px-wide filmstrip tile is 46% of its width and makes a lozenge, so the tile takes `rounded-md`. Drawers take `.island-flush` — their header bleeds to the edge and their content carries the inset. The filmstrip is not an island and has no inset: its `FILMSTRIP_PADDING` (4) is the clearance its scroll box owes a tile's focus ring (2px stroke, 2px offset), and its top carries `THUMBNAIL_LIFT` (4) on top of that, the room the current tile needs to rise out of the row. Nothing else. `overflow-x: auto` forces the other axis, so a ring or a lift with no room for it would raise a vertical scrollbar — the strip pins `overflow-y: hidden`, the one pairing that does not force, and reserves `FILMSTRIP_SCROLLBAR` (12) in its height. The horizontal bar stays visible and thin: on a narrow window it is what says there are more screens to the right. Reserved permanently rather than when it appears, since twelve transparent pixels on a surfaceless strip are invisible while a height that changed with the screen count would make the stage jump.
- **A thumbnail is captured for the tile that shows it**: `install-thumbnails.ts` sizes the crop at `THUMBNAIL_WIDTH/HEIGHT × 2`, not at a fraction of the artboard. A fixed `0.2` produced 88×191 for a tile rendered 106×232 in device pixels, so every preview was upscaled and soft, and the leftover ratio difference was cropped by `object-cover`. The capture also raises Fabric's `skipControlsDrawing`: `renderCanvas` draws the handles into the _lower_ context, the one being copied, so the selection frame was baked into the current screen's preview. Discarding the selection instead would send a `selection:cleared` all the way to the properties panel. The preview carries no `img-outline` either — that outline detaches an image lying directly on a surface, and this one is already framed by the tile's border; the two stacked 2px of frame on a 53px tile, and the outline, being rectangular, was clipped at the four corners by the rounded overflow, which is what made the preview look cropped.
- **A thumbnail shows the artboard's framing**: the filmstrip tile takes its width from `THUMBNAIL_WIDTH`, derived from `APP_STORE_TARGET`. Letting the label stretch the column cost the tile its ratio, and `object-cover` then cropped 21% of every preview. Nothing in the strip may hardcode a dimension — to widen a tile, raise `THUMBNAIL_HEIGHT` and let the width follow. It sits at 116 (→ 53 wide): 124 was measured against it and bought one character of label for 8px of strip.
- **A screen always has a name, so the strip always has its rows**: `defaultScreenName(index)` is that name until the user chooses another, the rename field opens on it prefilled and selected, and a field emptied falls back to it. The row used to appear at the first rename and only renamed screens wrote in it, which produced the two failures the user reported: a file where one tile carried a label and its neighbour carried blank, and a stage that jumped 22px the moment you named something. Both rows are now reserved permanently, `filmstripHeight()` takes no argument, and `stageInsets` no longer knows what screens are called — the strip costs the canvas 44px, once. `STAGE_BOTTOM_INSET_MAX` survives as the name drawers read, not as a worst case, since there is no longer a second case. At ten screens the strip needs 699px and scrolls below a ~1020px window, which is accepted.
- **The filmstrip has no surface of its own**: unlike the top bar and the drawers it carries no island, no tray, no card. It carries previews, and a preview is already a surface — a container around them stacked strip, tile and preview at three neighbouring lightnesses and spent 26px of canvas framing empty space. The tiles are what floats; the strip is only their scroll box. The light ramp was re-pitched to two levels since — stage 0.965, cards 1.0 — which makes a tray less separable than before, not more.
- **Nothing of the interface is laid on the preview, and only the current tile wears the marker**: the tile _is_ the button, and the number sits in its own row above the image. The badge lived on the preview for two releases because it cost no height there and because one veiled surface is easier to contrast than two themes; what it cost instead was a corner of every composition at once, in the one tool whose whole job is to show those compositions, and the user cannot judge a framing they have to subtract a chip from. Back on the stage it takes the theme's own tokens — `marker-fill` when current, `muted-foreground` otherwise — and the `black/60` literal is gone with it. Above the preview and not left of the name: the column is `THUMBNAIL_WIDTH` wide, and a 16px badge plus its gap took the label from nine characters to five. The box keeps `THUMBNAIL_BADGE_SIZE` (16) as a floor in both states, so becoming current shifts nothing; the rank is the rank, not a zero-padded matricule, since `01` reads as a code where one glyph is read at a glance. The actions handle is positioned against the column, so it carries `THUMBNAIL_LABEL_ROW` in its offset or it lands next to the number instead of on the preview it commands; it keeps a 28px hit box, not `hit-44`, because on a 46×100 tile a 44 square covered 42% of the preview and took the click meant for the screen, and the full action set is already on the tile's right-click. State is the badge turning `marker-fill` plus a `THUMBNAIL_LIFT` (4) rise out of the row and the only contact shadow in the strip, never a ring: the old 2px `--color-marker` halo on a 46px-wide tile was the thickest stroke in the app and read as a highlighter. The resting tiles carry no shadow at all — their border is structure enough, and five identical contact shadows in a row read as a sheet of stickers. `shadow-md` is island elevation: its low layer reaches some forty pixels under a tile that is 116 tall, and the scroll box cut it flat, since `overflow-x: auto` forces the other axis. The current tile's `--shadow-handle` fits in the 8px that `FILMSTRIP_PADDING` plus the lift leave beneath it — a shadow the strip cannot show whole is worse than none, it reads as a grey rectangle. The marker is only ever on the current screen — drawn under all ten it stopped being a state and became an ornament. The lift is what carries the state in dark theme, where a shadow step is close to invisible; under `prefers-reduced-motion` it drops and the badge plus the shadow carry it alone.
- **Reordering is shown, not promised**: dragging a tile parts the row by one `THUMBNAIL_SLOT` and hides the dragged tile, so the strip already holds the shape it will have on drop. Native HTML5 drag, no library: the browser draws the item under the cursor, and the shift always vacates the slot the pointer is over, so `dragover` cannot oscillate between two tiles. `FILMSTRIP_GAP` is declared in `lib/stage.ts` rather than left to `gap-2` because the layout and the shift must read the same number. A single lime bar sits in the vacated slot — the shift states the final arrangement, the bar states the insertion point, and the two differ when the opening is at the strip's edge or off screen. It is the one place the marker appears twice at once, and it is transient. `pointer-events-none` on it is a condition, not a precaution: it lies exactly where the cursor is, and would otherwise steal the `dragover` that picks the target.
- **Being edited and being selected are two states, and only the first wears the marker**: `activeScreenId` is the screen the stage shows; `picked` in `ScreensBar` is the set the next action will hit. ⌘/Ctrl adds or removes, ⇧ extends, a bare click collapses to one — and ⇧ deliberately does _not_ move the current screen, so the anchor holds across repeated clicks and the stage stays on the composition you were working on while you designate others. A co-selected tile takes the border the hover would have given it and a `bg-secondary` badge; the lime stays on the current screen alone, or it stops being "you are here" the moment three tiles wear it. `aria-pressed` therefore means "in the selection" and `aria-current` means "being edited" — the two coincide until they don't, and announcing nine screens as selected when one is live is the failure that distinction exists to prevent. The context menu names its own scope ("Supprimer 3 écrans"), because a menu that says "Supprimer" while deleting three is the same lie in the other direction; renaming and copying settings stay singular, since a name is not shared and one copies from a source. `targetIds` is the `useLayerActions` shape reused: the group applies only when the acted-on tile belongs to it. `picked` is never cleaned by an effect — it is re-read against the live project at each action, and the group silently lapses as soon as it no longer contains the current screen, which is what happens the instant the canvas changes screens. Dragging collapses it: the row only knows how to part by one `THUMBNAIL_SLOT`, and showing three tiles held while one moves would promise a block reorder that does not happen.
- **It narrows, it never refuses**: the editor is desktop-class but it renders at any width, because a window briefly dragged narrow is not a reason to replace the project with a card. `lib/stage.ts` derives every threshold from the same chrome constants — `DUAL_DRAWER_MIN_WIDTH` (drawers open one at a time, `setExclusiveDrawers` closing Layers and keeping the editing surface), `TOP_BAR_COMPACT_WIDTH` (the secondary actions fold into one overflow menu), `TOP_BAR_TOOLS_WIDTH` (the creation tools join them there; the folded iPhone entry drops the model submenu a flat menu cannot hold and uses the project's own model), and `FILMSTRIP_CENTERED_MIN_WIDTH` (the strip stops being centred and anchors left). Export never folds, and the drawers cap on the viewport rather than hang off it. Every one of these replaced something measured and silent: at 560px Export left the viewport, at 375px six controls did and the row still demanded 526px inside an island of 351, at 320px the drawers overlapped by 249px and the centred strip took 27px of the zoom HUD, which then swallowed the click meant for a tile. Read them through `useMediaQuery`, never a hardcoded breakpoint. What is _not_ promised below roughly 600px is a usable stage: one drawer covers nearly all of it, and that is the honest trade for still being able to reach every control.
- **Type**: Inter variable (UI, `index.html`), 14px body, tabular figures for numeric fields. No all-caps labels. Content fonts (text layers) load on demand.
- **Two surfaces, never three**: an island carries its controls directly. A panel section is a band — a `border-t` hairline plus the header's own top padding — never a recessed card, which would put the island, the card and the field on three levels and cost every field 18px of width. `surface-inner` survives only inside a modal.
- **A handle's elevation is a token**: `--shadow-handle` is the contact shadow of anything you grab (slider thumb, gradient stop) and `--shadow-handle-focus` the ring it takes under keyboard focus and while dragging. Both lived inline in two components at two different alphas — a difference nobody decided. A handle is not an island: it does not float on the three-layer `shadow-md/lg/xl` scale, it detaches from the surface it touches. Consume them as `shadow-(--shadow-handle)`, never as a literal `oklch()`. The one deliberate literal left is `border-white` on the gradient stop: it sits on the user's own gradient, not on chrome, so a themed ring would vanish on a dark stop in dark theme — same rationale as `SELECTION_INK`.
- **Field grammar**: single-line controls carry their label inline (`Select`/`Input`/`NumberField`/`FontPicker` `label` prop); only multi-line or composite controls get a stacked `.field-label` — including sliders (`Slider` `label` prop), unless the row they sit in already names them.
- **What is clickable says so under the cursor**: one rule in `index.css`'s `base` layer gives `cursor: pointer` to every interactive role — `button:not(:disabled)`, `summary`, `select`, and the ARIA roles a `div` can carry (`menuitem`, `option`, `tab`, `switch`, `checkbox`, `radio`, `button`) — and `default` to the `menu`/`listbox` surfaces behind them. Tailwind v4 dropped `cursor: pointer` from Preflight and nothing here noticed: measured, 35 controls rendered the arrow against 7 the hand, and a `div[role="menuitem"]`, falling back to `auto`, showed the text caret over its own label — a menu entry that presented itself as a paragraph to select. Being in `base` means any component-level `cursor-*` utility still wins, which is how the command palette keeps its arrow and the gradient stop its `ew-resize`. The role decides, not the tag, so the rule tracks the same contract screen readers read and needs no maintenance. `semantics.spec.ts` sweeps the page with a menu open and fails on anything that is neither `pointer`, `default`-when-disabled, nor a declared gesture cursor.
- **The properties panel leads with the type, not the geometry**: the section that only this kind of layer has comes first — Texte, Appareil, Image, Forme, Icône — and Transformation closes the panel. One selects a text to change its words and an icon to change its glyph, not to nudge X by a pixel; Transformation is the only section common to the six types, which makes it the base of the stack rather than its header.
- **A creation tool wears what it creates**: the icon tool takes `Star`, the glyph `createIconLayer` actually drops on the board, and never `Sparkles` — in an app that _has_ an AI feature, sparkles is that feature's sign, and on the tool row it announced a generator. The reading is the icon's, not the tooltip's: `aria-label` said "Ajouter Icône" the whole time and nobody read it. `LayerItem` takes the same glyph for the same type; a tool and its layer that disagree are two names for one thing.
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
