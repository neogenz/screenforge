# Task 15: Keyboard Shortcuts

## Context
PRD requires standard editor shortcuts: Cmd+Z/Cmd+Shift+Z for undo/redo, Cmd+C/V for copy/paste layers, Delete/Backspace for delete, Cmd+scroll for zoom. These make the editor feel professional and fast to use.

## Scope
- Create `use-keyboard` hook for global shortcut handling
- Implement all PRD-specified shortcuts
- Implement copy/paste layers (clone Fabric objects)
- Handle modifier keys correctly on macOS

## Implementation Details

### Files to Create
- `src/hooks/use-keyboard.ts` — global keyboard event handler

### Shortcut Map
| Shortcut | Action |
|---|---|
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘C` | Copy selected layer(s) |
| `⌘V` | Paste copied layer(s) |
| `⌘D` | Duplicate selected layer(s) |
| `Delete` / `Backspace` | Delete selected layer(s) |
| `⌘A` | Select all layers |
| `⌘⇧A` | Deselect all |
| `⌘+` / `⌘=` | Zoom in |
| `⌘-` | Zoom out |
| `⌘0` | Reset zoom to 100% |
| `Escape` | Deselect / close modal |
| `Arrow keys` | Nudge selected layer 1px |
| `⇧Arrow` | Nudge selected layer 10px |

### Implementation
```typescript
function useKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input/textarea
      if (isInputFocused()) return

      const meta = e.metaKey || e.ctrlKey
      // ... handle shortcuts
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
```

### Copy/Paste Logic
- Copy: serialize selected layer(s) to clipboard state (in-memory, not system clipboard)
- Paste: deserialize and create new layer(s) with offset position (+20px, +20px)
- Duplicate: copy + paste in one action

### Important Details
- Must not intercept shortcuts when user is editing text inline (Fabric IText editing mode)
- Must not intercept when focus is on input fields in properties panel
- Arrow key nudge should push to history stack (for undo)

## Success Criteria
- [ ] ⌘Z undoes last action
- [ ] ⌘⇧Z redoes
- [ ] ⌘C + ⌘V copies and pastes a layer (offset from original)
- [ ] Delete key removes selected layer
- [ ] ⌘A selects all layers
- [ ] Arrow keys nudge selected layer 1px
- [ ] ⇧Arrow nudges 10px
- [ ] Shortcuts DON'T fire when editing text in canvas
- [ ] Shortcuts DON'T fire when typing in input fields
- [ ] Escape closes open modals / deselects

## Testing & Validation

### Manual Testing Steps
1. Select layer, press ⌘C then ⌘V — verify copy appears offset
2. Press ⌘Z — verify paste is undone
3. Select layer, press Delete — verify removed
4. Double-click text to edit inline, press Delete — verify it deletes text char, not the layer
5. Focus on font size input, type number — verify shortcut doesn't fire
6. Press ⌘+ three times — verify zoom increases

### Edge Cases
- Shortcuts while modal is open (should be blocked or handled by modal)
- Paste with nothing in clipboard (no-op)
- Delete with nothing selected (no-op)
- Rapid undo/redo (must not break)

## Dependencies

**Must complete first**:
- Task 03: Zustand stores (history for undo/redo, UI for zoom)
- Task 04: Canvas wrapper (for layer operations)

**Blocks**: None

## Related Documentation
- **PRD**: Interactions (all keyboard shortcuts listed)
- **CLAUDE.md**: Architecture → `hooks/use-keyboard.ts`

---
**Estimated Time**: 1.5 hours
**Phase**: Polish
