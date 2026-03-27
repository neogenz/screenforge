# Task 03: Zustand Stores — Canvas, Project, History, UI

## Context
Zustand stores are the single source of truth for all app state. The Fabric.js canvas syncs bidirectionally with `canvas.store.ts`. Four stores following the slice pattern: canvas (layers/selection), project (metadata/screens/globals), history (undo/redo), and UI (panel states/zoom).

## Scope
- Create all 4 Zustand stores with full action sets
- Implement undo/redo as a command stack in history store
- Wire up project globals that propagate to new screens

## Implementation Details

### Files to Create
- `src/stores/canvas.store.ts` — layers, selection, active screen state
- `src/stores/project.store.ts` — project metadata, screens list, globals
- `src/stores/history.store.ts` — undo/redo command stack
- `src/stores/ui.store.ts` — panel visibility, zoom level, active tool

### canvas.store.ts
```typescript
interface CanvasState {
  layers: Layer[]
  selectedLayerIds: string[]
  activeScreenId: string

  // Actions
  addLayer: (layer: Layer) => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, updates: Partial<Layer>) => void
  selectLayer: (id: string) => void
  selectLayers: (ids: string[]) => void
  clearSelection: () => void
  reorderLayer: (id: string, newIndex: number) => void
  duplicateLayer: (id: string) => void
  setLayers: (layers: Layer[]) => void
}
```

### project.store.ts
```typescript
interface ProjectState {
  project: Project | null

  // Screen actions
  addScreen: () => void           // uses globals as defaults
  removeScreen: (id: string) => void
  duplicateScreen: (id: string) => void
  reorderScreens: (ids: string[]) => void
  setActiveScreen: (id: string) => void

  // Globals
  updateGlobals: (globals: Partial<GlobalSettings>) => void

  // Project CRUD
  createProject: (name: string) => void
  loadProject: (project: Project) => void
  updateProjectName: (name: string) => void
}
```

### history.store.ts
```typescript
// Command stack pattern
interface HistoryState {
  undoStack: Snapshot[]
  redoStack: Snapshot[]
  maxHistory: number  // cap at ~50

  pushSnapshot: (snapshot: Snapshot) => void
  undo: () => Snapshot | null
  redo: () => Snapshot | null
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}
```

### ui.store.ts
```typescript
interface UIState {
  zoom: number              // 0.25 to 4.0
  showLayersPanel: boolean
  showPropertiesPanel: boolean
  activeTool: 'select' | 'text' | 'shape' | 'image'

  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  toggleLayersPanel: () => void
  togglePropertiesPanel: () => void
  setActiveTool: (tool: string) => void
}
```

### Patterns
- Use `createStore` from `zustand/vanilla` if needed outside React
- Selectors for derived state (e.g., `selectedLayer` computed from `selectedLayerIds` + `layers`)
- No mega-store — keep stores independent, compose in components

## Success Criteria
- [ ] All 4 stores create without errors
- [ ] Canvas store: add/remove/update/select/reorder layers works
- [ ] Project store: add/remove/duplicate screens works
- [ ] Project store: new screens inherit global settings
- [ ] History store: push/undo/redo cycle works correctly
- [ ] History store: redo stack clears on new action
- [ ] UI store: zoom in/out stays within bounds (0.25–4.0)
- [ ] `npm run typecheck` passes
- [ ] Stores are importable from `@/stores/*`

## Testing & Validation

### Manual Testing Steps
1. Import stores in App.tsx, call actions, log state
2. Test undo/redo: make 3 changes, undo 2, verify state
3. Test undo then new action: verify redo stack is cleared
4. Add screen, verify it inherits globals

### Edge Cases
- Undo when stack is empty (no-op)
- Redo after new action (should clear redo stack)
- Delete last screen (should prevent or create new blank)
- History stack overflow (cap at maxHistory)

## Dependencies

**Must complete first**:
- Task 01: Project setup
- Task 02: Types (Layer, Screen, Project types)

**Blocks**:
- Task 04: Canvas wrapper (reads/writes canvas store)
- Task 08: Properties panel (reads/writes canvas store)
- Task 09: Layers panel (reads canvas store)
- Task 10: Toolbar (reads UI/history stores)
- Task 11: Screens bar (reads project store)

## Related Documentation
- **PRD**: Core Features §6 (Project Management), Interactions (Undo/Redo)
- **CLAUDE.md**: Zustand v5 standards, key data flow

---
**Estimated Time**: 2 hours
**Phase**: Foundation
