---
target: la barre du haut
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-05T04-50-12Z
slug: src-components-toolbar-topbar-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

# Critique — top bar (`src/components/toolbar/TopBar.tsx`, `ZoomHud.tsx`)

Surface mode: **Operate**.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Save status is `display:none` below 1280px; the zoom readout shows 25% for a canvas at 21.6%; no `aria-pressed` on any toggle |
| 2 | Match System / Real World | 2 | Nothing in the bar names the artefact; the device menu shows marketing diagonals, not 1320×2868 |
| 3 | User Control and Freedom | 3 | Undo/redo correct, Escape reverts a rename — but "Nouveau projet" exists nowhere in the app |
| 4 | Consistency and Standards | 2 | The add-tool rail reproduces `ToggleGroup`'s container verbatim for four one-shot actions; `title` differs from `aria-label` on all 13 title-bearing buttons |
| 5 | Error Prevention | 1 | At ≤1023px the centred rail hit-tests over the panel toggles; at 900px the Layers toggle is 100% dead and clicking it inserts a layer |
| 6 | Recognition Rather Than Recall | 2 | 11 icon-only controls with no visible label; every shortcut lives only in a native `title`, unreachable by keyboard |
| 7 | Flexibility and Efficiency | 2 | ⌘K is well surfaced; but no `role="toolbar"` (14 tab stops), `canvas.tabIndex === -1` so focus never reaches the canvas, and no 100% zoom |
| 8 | Aesthetic and Minimalist Design | 3 | Genuinely restrained; contrast never drops below 7.81:1 in either theme |
| 9 | Error Recovery | 1 | `disabled:pointer-events-none` kills the tooltip on ghosted Undo; the save *error* state is what vanishes below 1280px, and its live region never announces |
| 10 | Help and Documentation | 2 | A shortcuts overlay exists and ⌘K reaches it; the bar itself offers no entry point |
| **Total** | | **19/40** | **Below the usual 20-32 band** |

## Design Specificity Verdict

**Category-interchangeable.** Fourteen controls; exactly one glyph (`Smartphone`, TopBar.tsx:407) knows what this product makes. The composition is the standard editor template — identity left, tools centre, actions right — applied without asking what a screenshot tool needs.

The proof sits one click away. The Export dialog names the target (1320×2868), shows three validation checks and promises no partial download. That dialog is authored. The bar that opens it says `Exporter` beside a download arrow, never mentions a screen count or a dimension, and carries **324px of empty space** between the project name and the centred tools at 1512px. The widest void in the layout sits next to the one element that is starving.

**Deterministic scan**: `detect.mjs` returned `[]` (exit 0) on `src/components/toolbar` and on all six `ui/` primitives the bar consumes. A positive control on a deliberately bad file returned a finding, so the detector is live — but **the clean result is partly vacuous**: `loadDesignSystemForCwd` returns `null` for this repo, because the resolver only accepts `DESIGN.md`/`design.json` and this project's file is `.impeccable.md` with no YAML frontmatter. With no design system loaded, `allowedFontSizes` and `allowedRadii` are empty and the closed-scale rules **structurally cannot fire**. `[]` means "no generic anti-patterns"; it is not evidence of scale compliance. Scales were checked manually instead, and the *rendered* values do comply (heights 32/36, radius 8, type 14/11).

**Visual overlays**: not injected. Reported as browser measurement instead.

## Overall Impression

The bar is well made and says nothing. Its craft is real — derived island geometry, chroma-0 discipline, a contrast floor of 7.81:1 — and its content is a default toolkit. The single biggest opportunity is the 324px of dead space beside a project name clipped at 18 of 42 characters: that is where "10 écrans · 1320×2868 · valide" belongs, and it would make the bar the only place in the app that tells you what you are shipping before you commit.

But nothing ships until the click-steal is fixed.

## What's Working

1. **Derived island geometry, verified in the browser.** `--island-padding` = `--radius-xl − --radius-md` = 6px, so "inner radius = outer − inset" holds by construction rather than by assertion. Measured: island r=14 / pad=6, controls r=8.
2. **⌘K rendered as its own keycap** (TopBar.tsx:360-371). The affordance *is* the shortcut — it teaches the key while staying clickable.
3. **Achromatic discipline that survives contact.** Lowest measured contrast anywhere in the bar is 7.81:1; one full fill (Export, 13.9:1 light / 18.2:1 dark); lime only on the focus ring. Beside an artboard, this bar genuinely does not bias colour judgement.

## Priority Issues

### [P0] The centred tool rail steals clicks from the panel toggles

`TopBar.tsx:252` — `absolute left-1/2 -translate-x-1/2`. Out of flow, so it reserves no width and cannot be pushed; positioned, so it paints *and hit-tests* above the statically-positioned actions.

Measured: overlap begins at **≤1023px viewport width**. At 1000px the Layers toggle receives 20 of its 36px. At 900px it receives **0 of 36 — entirely dead** — and `elementFromPoint` returns `Ajouter Image` or `Ajouter Forme` across its whole span.

**Why it matters**: clicking the Layers toggle silently inserts a shape or an image layer. Not a no-op — a document mutation the user did not ask for, in an app that autosaves. A half-screen window on a 1920 display is 960px, inside the broken range.

**Fix**: replace the absolute centring with `grid grid-cols-[1fr_auto_1fr]` so the centre group centres *between* its flanks and can never reach them.

**Suggested command**: `/impeccable adapt`

### [P1] "Active" is a 1.075:1 fill, and it is not exposed to assistive tech

Two measurements that look contradictory and are not. Ink contrast is excellent (8.77-17.5:1). But *state* is carried only by a surface change: active `bg-secondary` measures **1.075:1** against the card in light, while `hover:bg-accent` measures **1.19:1**. **Hovering an inactive button makes it look more selected than an open panel.**

And no `aria-pressed` on either panel toggle — `data-active` is visual-only.

**Fix**: add `aria-pressed`; give active a second achromatic channel — `border-input` + `shadow-(--hairline-top)` + `text-foreground`, which is exactly what `ToggleGroupItem` already does and the bar declines to reuse.

**Suggested command**: `/impeccable polish`

### [P1] Save status disappears exactly when it matters

`TopBar.tsx:89` — `hidden … xl:flex`. Below 1280px the region is `display:none`, so a local-first app with no server offers zero save evidence. Because it is `display:none` and not visually-hidden, its `role="status" aria-live="polite"` **never announces at any width**. The state that vanishes with it is `error` → "Échec de l'enregistrement".

**Fix**: never hide it — collapse to icon-only below `xl` with the text in `aria-label`; or move the state onto the dot at TopBar.tsx:81, currently a static grey square sitting in the exact position every desktop app reserves for a dirty-document indicator.

**Suggested command**: `/impeccable harden`

### [P1] The add-tool rail wears a segmented selector's clothes

`TopBar.tsx:274` reproduces `ToggleGroup`'s container class string verbatim — `rounded-md border border-border bg-muted p-[3px]` — but holds four one-shot actions with no state. That treatment means "pick one, one is on" in the Uni/Dégradé/Préréglages control 400px away on the same screen.

Three compounding execution failures: it renders at **1.10:1** against the card in dark, so the grouping it exists to carry is invisible; it is **40px tall** against the bar's 36 and bleeds into the island's 6px inset — the only element that breaks the geometry rule; and it uses `p-[3px]` and `gap-[2px]`, arbitrary values in a file governed by a closed-scale guard.

**Fix**: delete the rail; use the bar's own `gap-1` + `Divider` grammar for the four tools.

**Suggested command**: `/impeccable distill`

### [P2] A 160px field for a 42-character name, beside 324px of empty bar

`TopBar.tsx:229` — `w-40`, `overflow: clip`, no `title`. "Captures App Store — Onboarding Premium v3" renders as "Captures App Stor…" — 18 of 42 characters. The field is transparent at rest so nothing signals it is editable, and the chevron menu offers only Télécharger / Ouvrir — no Renommer, and **no Nouveau projet, which exists nowhere in the app** (`src/lib/commands.ts` has `new-screen`, never `new-project`). A user with a finished project cannot start a fresh one.

**Fix**: `w-auto min-w-40 max-w-[28ch]` + `field-sizing: content`, `title={name}`, and add Nouveau projet / Renommer to the menu.

**Suggested command**: `/impeccable clarify`

## Persona Red Flags

**Alex (power user) — 10 screens per release, keyboard-first, window snapped to half a 1920 display (960px).** The bar is broken at his working width: the Layers toggle inserts rectangles. No `role="toolbar"`, so the bar is 14 tab stops with no roving focus, and `canvas.tabIndex === -1` means keyboard focus never reaches the artboard at all. No 100% view in a pixel-exact export tool: `ZOOM_STEP` is a flat additive 0.25 with no entry field. With 10 screens the fit scale is ≈0.16 but `ZOOM_MIN` is 0.25, so the HUD reads a number the canvas is not at — observed directly at session start: HUD 25%, actual viewport transform 0.2159.

**Jordan (first-timer) — indie dev, first submission.** Eleven glyphs with no visible label, two of them mirror images 40px apart. The recessed rail promises a mode picker and fires an action. "Ajouter Image" opens an OS file dialog with no `…` to warn. He cannot tell the project name is editable, and the menu where he would look to rename or start over offers neither. Nothing in the bar tells him he is producing 1320×2868 App Store screenshots until he opens Export.

**Screen-reader / keyboard user.** The app's primary control surface is a bare `<div>` — no `<header>`, no `role="banner"`, no `role="toolbar"`, no `aria-label`. Every icon-only control *does* carry an `aria-label` (measured: zero unnamed controls), but `aria-label` wins over `title` in name computation, so the shortcuts written into `title` are never announced. Four toggles expose no `aria-pressed`. The save-status live region never announces. The theme button announces "Changer de thème" while its `title` says "Passer en mode clair" — direction is sighted-only.

## Minor Observations

- The 8×8 dot (TopBar.tsx:81) is `aria-hidden`, hardcoded, never changes — decoration occupying the most semantically loaded pixel in the layout.
- Four icon sizes in one bar: 9, 11, 13, 16. Two stroke weights. The 13px Download beside a 14px label is optically undersized.
- The device tool's glyph is not optically centred: 29px of content in a 32px `px-0` button, so it sits 1.5px from the edge while its three neighbours sit 8px in.
- `Divider`'s comment argues `mx-1.5` against "`gap-0.5` en intra-groupe", but both segments use `gap-1`. The ratio it defends is 5×; the built ratio is 2.5×.
- ZoomHud is the only group whose 44px zones do not collide — centre pitch is exactly 44px — and it is the one group with no `.hit-44` applied.
- The zoom percentage is a button that performs "fit". Nothing marks it as actionable except a `title`.
- `resetZoom` sets `zoom: 1` before `fitAll` reports the real scale, so the readout flashes 100% on every fit. Initial store `zoom: 1` means the HUD shows 100% on first paint.
- `src/components/ui/` contains no Tooltip primitive despite CLAUDE.md listing one; 42 `title=` sites across the app depend on that gap.
- The theme class is applied in a `useEffect` with no inline bootstrap in `index.html`, so a light-theme user gets a dark first paint. Mechanism confirmed in source; duration not measured.

## Questions to Consider

1. Remove the `Smartphone` glyph. Name one pixel left in this bar that says "App Store screenshots".
2. The Export dialog knows the target is 1320×2868 and shows three validation checks. Why does the bar — with 324px of dead space — not show `10 écrans · 1320×2868 · valide` before the user commits?
3. If the rail's job is grouping, and it renders at 1.10:1, what is doing the grouping? And if the answer is "the divider beside it", why is the rail there?
4. Why is the first tab stop of a canvas application a text input, and why can focus never reach the canvas?
5. In a tool whose promise is pixel-exact export, why is 100% unreachable from the zoom HUD?
6. The dot at the far left sits where every desktop app puts "unsaved changes". Why is it decorative, while the real save state lives in 11px text that disappears at 1279px?
