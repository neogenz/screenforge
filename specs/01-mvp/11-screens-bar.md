# Task 11: Screens Bar — Screen Thumbnails, Navigation, Management

## Context
The bottom bar shows thumbnails of all screens in the project (up to 10, App Store max). Users click to switch screens, drag to reorder, and can add/duplicate/delete screens. This is central to the multi-screen workflow.

## Scope
- Create screens bar with thumbnail previews
- Implement screen switching (click thumbnail → load screen layers + background)
- Implement add, duplicate, delete screen actions
- Implement drag to reorder screens
- Generate thumbnails from canvas state

## Implementation Details

### Files to Create
- `src/components/screens-bar/ScreensBar.tsx` — main bar component
- `src/components/screens-bar/ScreenThumbnail.tsx` — individual thumbnail

### Bar Layout
```
[1] [2] [3] [4] [5] [+]
 ^active (highlighted border)
```

### Thumbnail Generation
- After each canvas change (debounced), export a small preview:
  `canvas.toDataURL({ multiplier: 0.1 })` → store as `screen.thumbnail`
- Thumbnail size: ~132×287px (10% of 6.9" dimensions)
- Display at ~60×130px with object-fit cover

### Screen Switching
1. User clicks thumbnail
2. Save current screen's layers to project store
3. Set new active screen in project store
4. Load new screen's layers into canvas store
5. Canvas re-renders with new layers + background

### Screen Management
- **Add** (`+` button): creates new screen with global defaults, max 10
- **Duplicate**: right-click → duplicate, or button — copies all layers
- **Delete**: right-click → delete, with confirmation if only 1 screen left
- **Reorder**: drag thumbnails horizontally

### UI Details
- Height: `h-24` (96px)
- Fixed bottom, full width
- Horizontal scroll if > ~8 screens
- Active screen: blue border
- Hover: slight scale or brightness
- `+` button: dashed border, centered `Plus` icon

## Success Criteria
- [ ] All project screens show as thumbnails
- [ ] Clicking thumbnail switches to that screen (layers + background load)
- [ ] Active screen has visual indicator (border)
- [ ] Thumbnails update after canvas changes (debounced)
- [ ] Add button creates new screen (up to 10)
- [ ] Duplicate creates exact copy of screen
- [ ] Delete removes screen (with fallback to prevent zero screens)
- [ ] Drag to reorder works
- [ ] Screen order persists in project store

## Testing & Validation

### Manual Testing Steps
1. Start with 1 screen — add text, verify thumbnail shows
2. Click `+` — verify new blank screen appears
3. Add content to screen 2
4. Switch between screens — verify content is correct
5. Duplicate screen — verify copy
6. Drag to reorder — verify order changes
7. Delete screen — verify removal

### Edge Cases
- Max 10 screens: `+` button should be disabled/hidden
- Delete last screen: prevent or create new blank
- Rapid screen switching (don't lose data in transit)
- Thumbnail generation during drag (should be debounced)

## Dependencies

**Must complete first**:
- Task 03: Zustand stores (project store for screens)
- Task 04: Canvas wrapper (for thumbnail generation)

**Blocks**: None — but completes the multi-screen workflow

## Related Documentation
- **PRD**: Core Features §6 (Project Management — up to 10 screens)
- **CLAUDE.md**: Architecture → `screens-bar/`

---
**Estimated Time**: 2 hours
**Phase**: Integration
