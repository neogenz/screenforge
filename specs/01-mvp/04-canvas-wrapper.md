# Task 04: Fabric.js Canvas Wrapper + Core Interactions

## Context
The canvas is the heart of the app — a Fabric.js v6 design surface where users manipulate layers visually. It syncs bidirectionally with `canvas.store.ts`: user edits on canvas → store update → properties panel reflects, and vice versa. This task creates the canvas component and the `use-canvas` hook that manages the Fabric.js lifecycle.

## Scope
- Create `use-canvas` hook for Fabric.js v7 lifecycle (init, destroy, resize)
- Create `CanvasEditor` component that renders the Fabric.js canvas
- Implement core interactions: select, drag, resize, rotate
- Implement zoom (Cmd+scroll) using `canvas.zoomToPoint(new Point(x, y), zoom)`
- Implement snap-to-grid + smart guides
- Bidirectional sync between Fabric.js objects and Zustand canvas store
- Handle canvas resize on window resize
- Use named imports from fabric: `import { Canvas, Point } from 'fabric'`
- Use `canvas.requestRenderAll()` for programmatic updates (batched rendering)

## Implementation Details

### Files to Create
- `src/hooks/use-canvas.ts` — Fabric.js lifecycle, event handlers, sync logic
- `src/components/canvas/CanvasEditor.tsx` — canvas component with ref management
- `src/components/canvas/canvas-utils.ts` — helper functions for Fabric ↔ Layer conversion

### use-canvas Hook
```typescript
interface UseCanvasOptions {
  containerId: string
  width: number   // display width (CSS)
  height: number  // display height (CSS)
}

// Hook manages:
// 1. Canvas creation/disposal
// 2. Event binding (object:modified, selection:created, etc.)
// 3. Store sync (Fabric objects → Zustand, Zustand → Fabric)
// 4. Zoom handling
// 5. Snap-to-grid logic
```

### Key Events to Handle
- `object:modified` → update layer in store (position, size, rotation)
- `object:moving` → show smart guides
- `selection:created` / `selection:updated` → update selectedLayerIds in store
- `selection:cleared` → clear selection in store
- `mouse:wheel` (with Cmd) → zoom

### Sync Strategy
- **Canvas → Store**: on Fabric events, extract properties and call `updateLayer()`
- **Store → Canvas**: subscribe to store changes, update Fabric objects when properties change from the panel
- Use layer `id` as Fabric object's `data.id` for mapping
- Debounce rapid updates (drag, resize) to avoid store thrashing

### Canvas Sizing
- Working canvas represents the target dimension (1320×2868 for 6.9")
- Display canvas scales to fit the viewport with zoom
- Use `canvas.setZoom()` for viewport transform
- Gray pasteboard around the canvas (like Figma/Photoshop)

### Smart Guides
- Show alignment lines when objects snap to:
  - Canvas center (horizontal/vertical)
  - Other object edges
  - Grid points (optional, 8px or 16px grid)
- Remove guides on `mouse:up`

## Success Criteria
- [ ] Canvas renders in the center panel with gray pasteboard
- [ ] Can add a Fabric.js rectangle programmatically and see it
- [ ] Click to select objects — selection reflected in canvas store
- [ ] Drag objects — position updates in store
- [ ] Resize handles work — dimensions update in store
- [ ] Rotation works
- [ ] Cmd+scroll zooms in/out smoothly
- [ ] Canvas resizes on window resize without breaking
- [ ] Store → canvas sync: changing a layer's position in store moves the object on canvas
- [ ] Smart guides appear when dragging near center/edges
- [ ] No memory leaks: canvas properly disposed on unmount

## Testing & Validation

### Manual Testing Steps
1. Load app, verify canvas renders with pasteboard
2. Add a test rect via console/dev tools, drag it around
3. Check store state reflects position changes
4. Zoom in/out with Cmd+scroll
5. Resize browser window — canvas should adapt

### Edge Cases
- Rapid drag events (debounce must prevent store flood)
- Zoom limits (0.25x to 4x)
- Window resize during drag operation
- Canvas disposal on component unmount (no orphan event listeners)

## Dependencies

**Must complete first**:
- Task 01: Project setup (Fabric.js installed)
- Task 02: Types (Layer type definitions)
- Task 03: Zustand stores (canvas store to sync with)

**Blocks**:
- Task 05: Background layer
- Task 06: Text layers
- Task 07: Device frame layers
- Task 08: Properties panel (needs canvas for visual feedback)

## Related Documentation
- **PRD**: Core Features §1 (Canvas Editor), Interactions
- **CLAUDE.md**: Canvas performance (debounce/throttle, <16ms per frame), use-canvas hook convention

---
**Estimated Time**: 3 hours
**Phase**: Foundation
