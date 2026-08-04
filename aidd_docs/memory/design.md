# Design

## System

- A compact desktop editor with full-bleed canvas and floating chrome; drawers overlay the stage rather than resize it.
- Feature UI composes CVA primitives from `src/components/ui/`; Tailwind utilities consume semantic CSS tokens.
- Dark is the default theme with a complete light override.

## Tokens

- `src/index.css` defines OKLCH surfaces and ink, 4px spacing, typography, radii, elevation, named z-levels, and reduced-motion behavior.
- Chrome surfaces are achromatic so they do not distort color judgment on the artboard.
- Lime is reserved for location/state and focus; primary actions use neutral fills, while red is reserved for destructive state.
- Canvas geometry shared with floating chrome lives in `src/lib/stage.ts`.

## Components

- Controls use the shared `Button`, `IconButton`, `Input`, `NumberField`, `Select`, `Slider`, `Switch`, `Dialog`, `Popover`, and related primitives.
- Single-line controls carry inline labels; only composite or multiline controls stack labels.
- Dense control heights, tabular numeric values, one primary CTA per dialog, and 120–200ms transform/opacity motion are the default grammar.

## Accessibility

- Text/surface contrast must remain at least 4.5:1 and pass `pnpm run audit:contrast`.
- Icon-only controls require accessible labels; dialogs trap and restore focus; menus, listboxes, switches, alerts, and live status use appropriate roles.
- Keyboard operation and visible focus are baseline behavior, with motion disabled under `prefers-reduced-motion`.
