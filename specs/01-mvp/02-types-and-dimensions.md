# Task 02: TypeScript Types + Apple Dimension Constants

## Context
Central type definitions and dimension constants that every feature depends on. The `types/index.ts` file is the single source of truth for data shapes. The `lib/dimensions.ts` file is the single source of truth for Apple screenshot dimensions — these must be pixel-exact per PRD.

## Scope
- Define all TypeScript types: Layer (union type), Screen, Project, ExportConfig, Background, DeviceFrame
- Define Apple dimension constants matching PRD table exactly
- Define gradient preset types

## Implementation Details

### Files to Create
- `src/types/index.ts` — all shared types
- `src/lib/dimensions.ts` — Apple dimension constants

### Type Definitions

```typescript
// Layer types (discriminated union)
type LayerType = 'text' | 'device-frame' | 'image' | 'shape' | 'background'

interface BaseLayer {
  id: string
  type: LayerType
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  visible: boolean
  zIndex: number
}

interface TextLayer extends BaseLayer {
  type: 'text'
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  textAlign: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  shadow?: TextShadow
  gradientFill?: GradientFill
}

// ... DeviceFrameLayer, ImageLayer, ShapeLayer

interface Screen {
  id: string
  name: string
  layers: Layer[]
  background: Background
  thumbnail?: string  // data URL for screens bar
}

interface Project {
  id: string
  name: string
  screens: Screen[]
  globals: GlobalSettings
  createdAt: number
  updatedAt: number
}

// Background, GradientFill, DeviceConfig, ExportConfig, etc.
```

### Dimension Constants
```typescript
interface DisplayClass {
  name: string
  size: string  // e.g. '6.9"'
  portrait: { width: number; height: number }
  landscape: { width: number; height: number }
  devices: string[]
  isPrimary: boolean
  isLegacy: boolean
}

// Must match PRD table exactly:
// 6.9" = 1320x2868 (primary)
// 6.7" = 1290x2796 (primary)
// 6.5" = 1284x2778
// 6.3" = 1206x2622 (iPhone 16e)
// 6.1" = 1179x2556
// 5.8" = 1125x2436
// 5.5" = 1242x2208 (legacy)
// 4.7" = 750x1334 (legacy)
// 4.0" = 640x1136 (legacy)
```

## Success Criteria
- [ ] All types compile with zero errors
- [ ] Dimension constants match PRD table exactly (all 9 display classes)
- [ ] Layer type is a proper discriminated union (narrowing works with `layer.type`)
- [ ] Types are exported and importable from `@/types`
- [ ] Dimension constants are the ONLY place dimensions are defined (no hardcoding elsewhere)
- [ ] `npm run typecheck` passes

## Testing & Validation

### Manual Testing Steps
1. Import types in a test file — verify autocomplete works
2. Verify discriminated union narrows correctly
3. Cross-reference every dimension value against PRD table

### Edge Cases
- Portrait AND landscape dimensions for each display class
- Legacy device classes must be marked

## Dependencies

**Must complete first**:
- Task 01: Project setup

**Blocks**:
- Task 03: Zustand stores (needs types)
- Task 04: Canvas wrapper (needs types)
- Task 12: Export (needs dimensions)

## Related Documentation
- **PRD**: "Accepted Dimensions" table, "Core Features" section
- **CLAUDE.md**: "Apple Dimension Constants", types convention

---
**Estimated Time**: 1 hour
**Phase**: Foundation
