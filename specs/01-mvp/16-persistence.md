# Task 16: IndexedDB Persistence — Save/Load Projects

## Context
Projects must persist across browser sessions. PRD specifies IndexedDB via `idb` library. This includes auto-save, manual save, and loading projects on app startup. Zero backend — everything local.

## Scope
- Create IndexedDB storage layer using `idb`
- Implement project save (manual + auto-save on changes)
- Implement project load on app startup
- Implement project listing (for future multi-project support)
- Handle image data persistence (base64 images in layers)

## Implementation Details

### Files to Create
- `src/lib/storage.ts` — IndexedDB read/write via `idb`

### Database Schema
```typescript
// Database: 'screenforge'
// Object stores:
// - 'projects': Project objects keyed by id

interface ScreenForgeDB extends DBSchema {
  projects: {
    key: string      // project id
    value: Project   // full project with all screens and layers
    indexes: {
      'by-updated': number  // updatedAt for sorting
    }
  }
}
```

### Storage API
```typescript
// Core operations
async function saveProject(project: Project): Promise<void>
async function loadProject(id: string): Promise<Project | undefined>
async function listProjects(): Promise<ProjectSummary[]>
async function deleteProject(id: string): Promise<void>

// Auto-save
function setupAutoSave(store: ProjectStore, intervalMs?: number): () => void
```

### Auto-Save Strategy
- Debounced: save 2 seconds after last change
- Subscribe to project store changes
- Only save if state actually changed (dirty flag or deep compare)
- Show subtle "Saving..." → "Saved" indicator in toolbar

### Startup Flow
1. App loads → check IndexedDB for projects
2. If project exists → load most recent (by `updatedAt`)
3. If no project → create default "Untitled Project" with 1 blank screen
4. Hydrate Zustand stores from loaded project

### Data Considerations
- Image layers store base64 data → can be large
- Consider storing images as separate blobs in IndexedDB if > 1 MB
- Device frame SVGs are bundled assets, not stored per-project
- Google Font names are stored, fonts re-loaded on demand

## Success Criteria
- [ ] Project saves to IndexedDB on manual save (toolbar button)
- [ ] Project auto-saves after changes (debounced)
- [ ] Project loads on app startup
- [ ] All layers, backgrounds, and screen data persist correctly
- [ ] Image data (base64) persists and loads correctly
- [ ] "Saving..." / "Saved" indicator visible in toolbar
- [ ] New browser tab loads the saved project
- [ ] Empty state: creates default project if none exists
- [ ] `listProjects()` returns saved projects

## Testing & Validation

### Manual Testing Steps
1. Create project with text + device + background
2. Close browser tab
3. Reopen — verify project loads with all content intact
4. Make a change — verify auto-save indicator
5. Open DevTools → Application → IndexedDB — verify data stored

### Edge Cases
- Very large project (many images) — should still save
- Concurrent tabs (not a priority, but shouldn't corrupt data)
- IndexedDB not available (show error, don't crash)
- Corrupted data in IndexedDB (handle gracefully)

## Dependencies

**Must complete first**:
- Task 01: Project setup (`idb` dependency)
- Task 02: Types (Project type)
- Task 03: Zustand stores (project store to persist)

**Blocks**: None — but should be done before final testing

## Related Documentation
- **PRD**: Core Features §6 (Project Management), Tech Stack (IndexedDB via idb)
- **CLAUDE.md**: Architecture → `lib/storage.ts`

---
**Estimated Time**: 2 hours
**Phase**: Polish
