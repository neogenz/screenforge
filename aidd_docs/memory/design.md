# Design

## System

- A compact desktop editor with full-bleed canvas and floating chrome; drawers overlay the stage rather than resize it.
- Feature UI composes CVA primitives from `src/components/ui/`; Tailwind utilities consume semantic CSS tokens.
- Dark is the default theme with a complete light override.

## Tokens

- `src/index.css` follows the shadcn token contract; only 16 tokens sit outside it, for concepts shadcn has no name for, plus six named z-levels.
- `src/index.css` defines OKLCH surfaces and ink, 4px spacing, typography, radii, elevation, named z-levels, and reduced-motion behavior.
- Chrome surfaces are achromatic so they do not distort color judgment on the artboard. The stage carries a dot grain rather than a flat fill, from a token that lightens on dark and darkens on light; being decorative it is deliberately excluded from the contrast matrix.
- The light theme runs on two levels rather than a five-step ramp: a near-white stage, white islands, and the elevation tokens doing the separating. A lighter stage gives a shadow more room to bite than a grey one did.
- Lime lives under `--color-marker`, reserved for location/state and focus; `accent` keeps its shadcn meaning of neutral hover surface. Primary actions use neutral fills, while red is reserved for destructive state.
- The rendered scales are closed and checked: three type sizes, two line-heights, two control heights, four radii, two vertical gaps. The radii derive from one upstream value whose multipliers are fifths, so any multiple of 5px keeps the chain integer; a narrow element takes a smaller step than the island scale, since an island radius on a 46px-wide tile makes a lozenge.
- Line-height is declared in px on a 4px grid, never as a ratio; the named ratio utilities are removed from the theme and the scale guard rejects any rendered value off the grid.
- Canvas geometry shared with floating chrome lives in `src/lib/stage.ts`; `.island` carries a 6px inset derived from the radius chain so the inner-radius rule holds by construction. The filmstrip is not an island: its padding is the clearance its scroll box owes a tile's focus ring, since `overflow-x: auto` forces the vertical axis too.
- The same file derives the responsive thresholds: one drawer at a time below `DUAL_DRAWER_MIN_WIDTH`, a folded overflow menu in the top bar below `TOP_BAR_COMPACT_WIDTH`, and a stated minimum width below `MIN_APP_WIDTH`. The editor is desktop-class and declares its floor rather than pushing controls off-screen.

## Components

- Controls use the shared `Button`, `IconButton`, `Input`, `NumberField`, `Select`, `Slider`, `Switch`, `Dialog`, `Popover`, and related primitives.
- Single-line controls carry inline labels; only composite or multiline controls stack labels, sliders included when nothing else names them.
- Panel sections are hairline-separated bands, so no chrome stacks more than two surfaces; recessed cards remain a modal device.
- Layer rows show a text layer's own content until it is renamed, and the filter searches what the rows display.
- Filmstrip tiles are sized from the export target's ratio so the preview shows the real framing; widening a tile means raising its height and letting the width follow. A name row appears under the tiles only once a screen carries a chosen name, and only such screens write in it — the factory name is the rank spelled out, which the badge already shows. The row changes the strip's height, so the stage insets take it as a parameter and the viewport recenters when it appears or goes; the full name always remains in the tooltip, the context menu and the artboard label.
- The filmstrip carries no surface of its own; the previews are the surfaces and a container around them would stack three neighbouring lightnesses. Each tile is a single button, and its number is a badge inside the preview rather than a row beneath it: on the image the badge has one surface to contrast instead of two themes plus a mostly-light capture, and the strip gives the canvas back the row's height. The badge's veil and ink are deliberate literals with a stated worst-case ratio, because they land on user content, not on chrome. The current screen is the one whose badge turns lime, rises out of the row and takes one step up the shadow scale; a ring is never used for state, and under reduced motion the rise drops while the badge and shadow keep carrying it. Reordering is previewed during the drag itself: the row parts by one slot and the dragged tile hides, so the strip shows its post-drop shape rather than only reflowing after the release.
- Dense control heights, tabular numeric values, one primary CTA per dialog, and 120–200ms transform/opacity motion are the default grammar.
- Grab handles share a contact-shadow token and a focus-ring token rather than inline shadow literals; they sit outside the island elevation scale because a handle detaches from its surface instead of floating above it. Ink that lands on user content, not on chrome, stays deliberately unthemed.
- Lazy dialogs immediately show a token-based modal loading surface with an announced status; reduced-motion users get the same feedback without animation.
- `index.html` paints a named boot skeleton inside `#root` — React clears the container on mount, so nothing has to remove it — and loads the font stylesheet off the critical path. The critical bundle is ~272 kB gzip and mostly Fabric, which a canvas editor needs on first paint; the fix is feedback, not further splitting.
- If durable storage is unavailable, the editor remains usable in memory while the save status and a persistent alert disclose that closing the tab will lose the session.

## Accessibility

- Text/surface contrast must remain at least 4.5:1 and pass `pnpm run audit:contrast`; the rendered scales must pass `pnpm run audit:scale`.
- Icon-only controls require accessible labels; dialogs trap and restore focus; menus, listboxes, switches, alerts, and live status use appropriate roles.
- Heading levels are real elements, not classes: an `sr-only` `<h1>`, `<h2>` panel titles, `<h3>` section titles, and a collapsible section is an `<h3>` wrapping its `aria-expanded` button. The top bar is a `<header>` and each panel an `<aside aria-labelledby>`.
- Keyboard operation and visible focus are baseline behavior. Under `prefers-reduced-motion` only movement is removed: `transform` leaves the transition list and sliding entrances become fades, so state feedback stays visible.
- Chrome density keeps most controls at 32–36px; 44px hit areas are only applied where the extended zone cannot steal a neighbour's click.
