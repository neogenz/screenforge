# Task 09: Layers Panel — Layer List, Reorder, Visibility

## Context
The left panel shows all layers in the current screen, ordered by z-index (top = front). Users can select, reorder (drag), toggle visibility, lock, rename, and delete layers from this panel. It also has buttons to add new layers.

## Scope
- Create layers panel with draggable layer list
- Implement layer reordering via drag & drop
- Implement visibility toggle, lock toggle, rename, delete
- Add layer buttons (text, shape, image, device frame)
- Wire to canvas store

## Implementation Details

### Files to Create
- `src/components/layers-panel/LayersPanel.tsx` — main panel
- `src/components/layers-panel/LayerItem.tsx` — individual layer row

### Layer List
- Ordered by z-index (highest = top of list)
- Each row shows:
  - Drag handle (left)
  - Layer type icon (Lucide: `Type`, `Smartphone`, `Image`, `Square`)
  - Layer name (click to rename inline)
  - Visibility eye toggle (Lucide: `Eye` / `EyeOff`)
  - Lock toggle (Lucide: `Lock` / `Unlock`)
- Selected layer highlighted
- Click to select (multi-select with Shift/Cmd)

### Add Layer Buttons
- Row of icon buttons at panel bottom:
  - `+ Text` → adds new text layer
  - `+ Device` → opens device picker or adds default device
  - `+ Image` → opens file picker for image import
  - `+ Shape` → adds rectangle (with shape options in properties)

### Drag Reorder
- Use HTML drag & drop or a lightweight library
- Dragging a layer moves it in z-index order
- Update `canvas.store.reorderLayer()` on drop
- Canvas re-renders with new z-order

### Layer Actions (right-click context menu or inline)
- Duplicate layer
- Delete layer
- Move to front / back
- Rename

### Panel UI
- Width: `w-60` (240px)
- Scrollable list
- Compact rows (32-36px height)
- Panel header: "Layers"

## Success Criteria
- [ ] All layers in current screen listed in z-order
- [ ] Click layer → selects on canvas + highlights in panel
- [ ] Select on canvas → highlights in panel
- [ ] Drag to reorder → z-index updates on canvas
- [ ] Eye toggle hides/shows layer on canvas
- [ ] Lock toggle prevents selection/moving on canvas
- [ ] Click layer name → inline rename
- [ ] Add Text button creates text layer
- [ ] Add Shape button creates rectangle
- [ ] Delete works (Backspace or button)
- [ ] Switching screens updates layer list

## Testing & Validation

### Manual Testing Steps
1. Add 3 layers (text, shape, device) — verify all show in panel
2. Click layer in panel — verify selected on canvas
3. Drag to reorder — verify z-order changes on canvas
4. Toggle visibility — verify layer hides/shows
5. Toggle lock — verify layer can't be selected on canvas
6. Rename layer — verify name persists
7. Delete layer — verify removed from canvas and panel

### Edge Cases
- Empty layer list (no layers yet)
- Reorder with locked layers
- Delete selected layer (selection should clear)
- Very long layer names (truncate with ellipsis)

## Dependencies

**Must complete first**:
- Task 03: Zustand stores (canvas store)
- Task 04: Canvas wrapper (layer display)

**Blocks**: None — integration task

## Related Documentation
- **PRD**: Core Features §1 (Layer reordering), UI Layout (left panel)
- **CLAUDE.md**: Architecture → `layers-panel/`

---
**Estimated Time**: 2 hours
**Phase**: Integration
