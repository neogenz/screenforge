# Task 08: Properties Panel — Context-Sensitive Layer Properties Editor

## Context
The right panel shows properties for the currently selected layer. It dynamically switches based on layer type: text properties for text layers, device options for device frames, transform for shapes/images, and background editor when no layer is selected.

## Scope
- Create properties panel shell with dynamic section rendering
- Wire to canvas store selection state
- Render appropriate controls per layer type
- Two-way binding: panel edits → store → canvas update

## Implementation Details

### Files to Create
- `src/components/properties-panel/PropertiesPanel.tsx` — main panel shell
- `src/components/properties-panel/TransformSection.tsx` — position, size, rotation, opacity (all layers)
- `src/components/properties-panel/TextSection.tsx` — wraps TextEditor for text layers
- `src/components/properties-panel/DeviceSection.tsx` — wraps DevicePicker for device frame layers
- `src/components/properties-panel/ImageSection.tsx` — image-specific controls
- `src/components/properties-panel/ShapeSection.tsx` — shape-specific controls (fill, stroke)
- `src/components/properties-panel/BackgroundSection.tsx` — wraps BackgroundEditor (shown when no selection)

### Panel Logic
```
if (no layer selected) → show BackgroundEditor
else →
  show TransformSection (always)
  switch (selectedLayer.type):
    'text'         → show TextSection
    'device-frame' → show DeviceSection
    'image'        → show ImageSection
    'shape'        → show ShapeSection
```

### TransformSection (shared across all layer types)
- X position: numeric input
- Y position: numeric input
- Width: numeric input
- Height: numeric input
- Rotation: numeric input + drag
- Opacity: slider 0–100%
- Lock aspect ratio: toggle

### Two-Way Binding Flow
1. User changes value in panel → call `canvasStore.updateLayer(id, { prop: value })`
2. Store update triggers canvas sync (from Task 04)
3. User drags object on canvas → Fabric event → store update
4. Store update triggers React re-render → panel shows new values

### UI Details
- Panel width: `w-72` (288px)
- Scrollable when content overflows
- Section headers with collapse toggle
- Numeric inputs: click to type, drag to scrub
- All inputs: immediate update (no save button)

## Success Criteria
- [ ] Panel shows BackgroundEditor when nothing is selected
- [ ] Selecting a text layer shows text controls
- [ ] Selecting a device frame shows device controls
- [ ] Changing X/Y in panel moves object on canvas
- [ ] Dragging object on canvas updates X/Y in panel
- [ ] Opacity slider works bidirectionally
- [ ] Rotation input works bidirectionally
- [ ] Panel scrolls when content overflows
- [ ] Multi-select shows only TransformSection (common properties)
- [ ] Smooth, lag-free interaction (debounced updates)

## Testing & Validation

### Manual Testing Steps
1. Click canvas (no object) — verify BackgroundEditor shows
2. Add text, select it — verify text controls appear
3. Change font size in panel — verify canvas updates
4. Drag text on canvas — verify panel X/Y updates
5. Add device frame, select it — verify device controls appear
6. Deselect — verify panel returns to BackgroundEditor

### Edge Cases
- Rapid property changes (must debounce store updates)
- Select → delete → panel should revert to background
- Multi-select two different layer types (show only common properties)

## Dependencies

**Must complete first**:
- Task 03: Zustand stores (canvas store for selection state)
- Task 04: Canvas wrapper (bidirectional sync)
- Task 05: Background editor component
- Task 06: Text editor component
- Task 07: Device picker component

**Blocks**:
- No blockers — this is an integration task

## Related Documentation
- **PRD**: UI Layout (right panel), Core Features
- **CLAUDE.md**: Architecture → `properties-panel/`, key data flow

---
**Estimated Time**: 2 hours
**Phase**: Integration
