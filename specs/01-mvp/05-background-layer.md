# Task 05: Background Layer — Solid Color, Gradients, Presets

## Context
Every screenshot needs a background. The PRD specifies solid color, linear gradient, radial gradient, and 20+ preset gradients. The background is the bottom-most layer on each screen and is configured separately from other layers.

## Scope
- Implement background rendering on Fabric.js canvas (solid + linear/radial gradients)
- Create reusable color picker component (hex/rgb input)
- Create gradient editor component (angle control + color stops)
- Create preset gradient gallery (20+ curated gradients)
- Wire background changes to canvas store and render on canvas

## Implementation Details

### Files to Create
- `src/components/background-editor/BackgroundEditor.tsx` — main background config panel
- `src/components/color-picker/ColorPicker.tsx` — reusable color picker with hex/rgb input
- `src/components/gradient-editor/GradientEditor.tsx` — gradient angle + color stops editor
- `src/assets/gradients.ts` — 20+ preset gradient definitions

### Background Types
```typescript
type Background =
  | { type: 'solid'; color: string }
  | { type: 'linear-gradient'; angle: number; stops: ColorStop[] }
  | { type: 'radial-gradient'; centerX: number; centerY: number; stops: ColorStop[] }

interface ColorStop {
  color: string
  offset: number  // 0-1
}
```

### Gradient Presets (examples)
- Sunset (warm orange → pink → purple)
- Ocean (deep blue → teal)
- Aurora (green → blue → purple)
- Midnight (dark navy → black)
- Coral (salmon → rose)
- Emerald (green → dark green)
- Lavender (light purple → blue)
- Fire (red → orange → yellow)
- etc. (20+ total)

### Color Picker Features
- Color swatch / hue selector
- Hex input (#RRGGBB)
- RGB sliders
- Opacity slider (for gradients)
- Recent colors (in-memory, per session)

### Canvas Integration
- Solid: `canvas.backgroundColor = color`
- Linear gradient: create `Gradient` with coords from angle
- Radial gradient: create `Gradient({ type: 'radial' })`
- Re-render on every background change

## Success Criteria
- [ ] Can set solid color background via color picker
- [ ] Can create linear gradient with custom angle + 2+ color stops
- [ ] Can create radial gradient with adjustable center point
- [ ] Can add/remove color stops in gradient editor
- [ ] 20+ preset gradients render correctly when selected
- [ ] Background persists in screen state (store)
- [ ] Switching screens shows correct background per screen
- [ ] Color picker shows hex/rgb input and opacity

## Testing & Validation

### Manual Testing Steps
1. Set solid background — verify canvas updates
2. Switch to linear gradient, adjust angle — verify rotation
3. Add 3rd color stop — verify smooth transition
4. Try radial gradient — verify center point
5. Click preset — verify it applies
6. Switch to different screen and back — background persists

### Edge Cases
- Gradient with single stop (should still render as solid)
- Very long hex input (must validate/clamp)
- Angle wrapping (360° = 0°)

## Dependencies

**Must complete first**:
- Task 04: Canvas wrapper (need canvas to render backgrounds)

**Blocks**:
- Task 06: Text layers (may reuse color picker for text color)
- Task 08: Properties panel (background section)

## Related Documentation
- **PRD**: Core Features §3 (Background Designer)
- **CLAUDE.md**: Architecture → `background-editor/`, `color-picker/`, `gradient-editor/`

---
**Estimated Time**: 2.5 hours
**Phase**: Core Features
