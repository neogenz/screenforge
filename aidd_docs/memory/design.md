# Design

## System

- A compact desktop editor with full-bleed canvas and floating chrome; drawers overlay the stage rather than resize it.
- Feature UI composes CVA primitives from `src/components/ui/`; Tailwind utilities consume semantic CSS tokens.
- Dark is the default theme with a complete light override.

## Tokens

- `src/index.css` follows the shadcn token contract; only 13 tokens sit outside it, for concepts shadcn has no name for.
- `src/index.css` defines OKLCH surfaces and ink, 4px spacing, typography, radii, elevation, named z-levels, and reduced-motion behavior.
- Chrome surfaces are achromatic so they do not distort color judgment on the artboard.
- Lime lives under `--color-marker`, reserved for location/state and focus; `accent` keeps its shadcn meaning of neutral hover surface. Primary actions use neutral fills, while red is reserved for destructive state.
- The rendered scales are closed and checked: three type sizes, two control heights, four radii, two vertical gaps.
- Canvas geometry shared with floating chrome lives in `src/lib/stage.ts`; `.island` carries a 6px inset derived from the radius chain so the inner-radius rule holds by construction.

## Components

- Controls use the shared `Button`, `IconButton`, `Input`, `NumberField`, `Select`, `Slider`, `Switch`, `Dialog`, `Popover`, and related primitives.
- Single-line controls carry inline labels; only composite or multiline controls stack labels.
- Dense control heights, tabular numeric values, one primary CTA per dialog, and 120–200ms transform/opacity motion are the default grammar.
- Lazy dialogs immediately show a token-based modal loading surface with an announced status; reduced-motion users get the same feedback without animation.
- If durable storage is unavailable, the editor remains usable in memory while the save status and a persistent alert disclose that closing the tab will lose the session.

## Accessibility

- Text/surface contrast must remain at least 4.5:1 and pass `pnpm run audit:contrast`; the rendered scales must pass `pnpm run audit:scale`.
- Icon-only controls require accessible labels; dialogs trap and restore focus; menus, listboxes, switches, alerts, and live status use appropriate roles.
- Keyboard operation and visible focus are baseline behavior. Under `prefers-reduced-motion` only movement is removed: `transform` leaves the transition list and sliding entrances become fades, so state feedback stays visible.
- Chrome density keeps most controls at 32–36px; 44px hit areas are only applied where the extended zone cannot steal a neighbour's click.
