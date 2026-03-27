# Task 17: Global Settings — Shared Defaults Across Screens

## Context
PRD requires "Globals" — shared settings that propagate to new screens: default font family + weight + color, default background, default device type + color variant. Existing screens can override globals. This ensures design consistency across all screenshots.

## Scope
- Create globals settings panel/modal
- Wire globals to project store
- Ensure new screens inherit globals
- Allow per-screen overrides

## Implementation Details

### Files to Create
- `src/components/globals-editor/GlobalsEditor.tsx` — globals settings modal/panel

### Global Settings Shape
```typescript
interface GlobalSettings {
  fontFamily: string
  fontWeight: number
  fontSize: number
  fontColor: string
  background: Background
  deviceModel: string
  deviceColor: string
}
```

### UI Layout (modal or slide-out panel)
- **Typography defaults**
  - Font family picker (reuse FontPicker)
  - Font weight selector
  - Font size input
  - Font color picker
- **Background default**
  - Reuse BackgroundEditor
- **Device default**
  - Model dropdown
  - Color variant picker

### Propagation Logic
- New screen created → copy globals as initial values
- Changing globals does NOT retroactively change existing screens
- Optional: "Apply to all screens" button that overwrites existing screens' matching properties

### Access
- Opened from toolbar "Settings/Globals" button
- Or from a gear icon in the screens bar

## Success Criteria
- [ ] Globals editor opens from toolbar
- [ ] Can set default font family, weight, size, color
- [ ] Can set default background (solid or gradient)
- [ ] Can set default device model + color
- [ ] New screen inherits all global defaults
- [ ] Existing screens are NOT changed when globals change
- [ ] "Apply to all" button works (optional, nice-to-have)
- [ ] Globals persist with project (saved to IndexedDB)

## Testing & Validation

### Manual Testing Steps
1. Set globals: Inter 48px Bold, blue gradient background
2. Add new screen — verify it has Inter 48px, blue gradient
3. Change globals to Roboto 36px
4. Add another new screen — verify Roboto 36px
5. Screen 2 should still have Inter 48px (not retroactive)

### Edge Cases
- Globals font not loaded yet (load on demand)
- Default device model not matching any asset (fallback)

## Dependencies

**Must complete first**:
- Task 03: Zustand stores (project store globals)
- Task 05: Background editor (reused)
- Task 06: Text editor / font picker (reused)
- Task 07: Device picker (reused)

**Blocks**: None

## Related Documentation
- **PRD**: Core Features §6 (Globals)
- **CLAUDE.md**: Architecture → project store globals

---
**Estimated Time**: 1.5 hours
**Phase**: Polish
