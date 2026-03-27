# Task 10: Toolbar — Save, Undo/Redo, Zoom, Export Access

## Context
The top toolbar provides quick access to core actions: save project, undo/redo, zoom controls, and opening export/template/globals dialogs. It's always visible and reflects current state (undo availability, zoom level).

## Scope
- Create toolbar component with action buttons
- Wire undo/redo buttons to history store
- Wire zoom display and controls to UI store
- Add buttons to open export dialog, template picker, globals settings
- Save button triggers IndexedDB persistence

## Implementation Details

### Files to Create
- `src/components/toolbar/Toolbar.tsx` — main toolbar bar

### Toolbar Layout (left to right)
```
[Save] | [Undo] [Redo] | [Zoom -] [100%] [Zoom +] | [Globals] [Templates] [Export]
```

### Buttons & Behavior
| Button | Icon | Action |
|---|---|---|
| Save | `Save` | Persist project to IndexedDB |
| Undo | `Undo2` | Pop history stack |
| Redo | `Redo2` | Push from redo stack |
| Zoom Out | `ZoomOut` | Decrease zoom (25% steps) |
| Zoom Level | — | Display current zoom (e.g., "100%"), click to reset |
| Zoom In | `ZoomIn` | Increase zoom (25% steps) |
| Globals | `Settings` | Open globals settings panel/modal |
| Templates | `LayoutTemplate` | Open template picker modal |
| Export | `Download` | Open export dialog |

### State Connections
- Undo/Redo disabled state from `historyStore.canUndo` / `canRedo`
- Zoom display from `uiStore.zoom`
- Save shows brief "Saved" indicator after success

### UI Details
- Height: `h-12` (48px)
- Fixed top, full width
- Subtle bottom border
- Buttons: icon + tooltip on hover
- Keyboard shortcuts shown in tooltips (e.g., "Undo (⌘Z)")
- Disabled buttons: reduced opacity, no pointer events

## Success Criteria
- [ ] Toolbar renders with all buttons
- [ ] Undo/Redo buttons correctly enable/disable based on history state
- [ ] Clicking Undo reverts last action
- [ ] Clicking Redo re-applies
- [ ] Zoom +/- changes zoom level on canvas
- [ ] Zoom display shows current percentage
- [ ] Click zoom display resets to 100%
- [ ] Export button opens export dialog (or placeholder)
- [ ] Templates button opens template picker (or placeholder)
- [ ] Save button persists to IndexedDB (or placeholder)
- [ ] All buttons have Lucide icons + hover tooltips

## Testing & Validation

### Manual Testing Steps
1. Make a change → click Undo → verify it reverts
2. Click Redo → verify it re-applies
3. Zoom in 3 times → verify display shows 175%
4. Click zoom display → verify resets to 100%
5. Verify disabled state when nothing to undo

### Edge Cases
- Undo when empty (button should be disabled)
- Rapid clicking undo/redo
- Zoom at boundaries (25% min, 400% max)

## Dependencies

**Must complete first**:
- Task 01: Project setup (Lucide icons)
- Task 03: Zustand stores (history + UI stores)

**Blocks**:
- Task 12: Export dialog (toolbar opens it)
- Task 13: Templates (toolbar opens picker)

## Related Documentation
- **PRD**: UI Layout (top bar), Interactions (undo/redo, zoom)
- **CLAUDE.md**: Architecture → `toolbar/`

---
**Estimated Time**: 1.5 hours
**Phase**: Integration
