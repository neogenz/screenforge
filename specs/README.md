# Implementation Tasks — ScreenForge

## Project Summary
**From PRD**: Local-first web app for designing and exporting iPhone App Store screenshots. Replaces paid tools like AppScreens.com. Zero backend, zero recurring cost.

**Tech Stack**: Vite + React 19 + TypeScript + Fabric.js v6 + Zustand v5 + Tailwind CSS v4 + IndexedDB (idb) + JSZip

**Current State**: Clean slate — no code yet. PRD and CLAUDE.md ready.

## Task Execution Guidelines
- Read complete task before starting
- Check dependencies are met
- Follow CLAUDE.md patterns (React 19, Zustand v5, Tailwind v4 standards)
- Validate against success criteria before marking done
- Run `npm run typecheck` and `npm run lint` after each task

## MVP Tasks (specs/01-mvp/)

### Phase 1: Foundation
- [ ] `01-project-setup.md` — Vite + React 19 + Tailwind v4 + all deps + editor layout shell
- [ ] `02-types-and-dimensions.md` — TypeScript types + Apple dimension constants
- [ ] `03-zustand-stores.md` — 4 Zustand stores (canvas, project, history, UI)
- [ ] `04-canvas-wrapper.md` — Fabric.js canvas + use-canvas hook + core interactions

### Phase 2: Core Features
- [ ] `05-background-layer.md` — Solid colors, gradients, presets + color picker + gradient editor
- [ ] `06-text-layers.md` — Full typography + Google Fonts picker
- [ ] `07-device-frame-layers.md` — iPhone SVG frames + screenshot slot
- [ ] `12-image-and-shape-layers.md` — Image import + shape layers (rect, circle, rounded rect)
- [ ] `14-export.md` — Single + batch export at Apple dimensions → ZIP

### Phase 3: Integration
- [ ] `08-properties-panel.md` — Context-sensitive properties editor (right panel)
- [ ] `09-layers-panel.md` — Layer list, reorder, visibility, lock (left panel)
- [ ] `10-toolbar.md` — Save, undo/redo, zoom, export access (top bar)
- [ ] `11-screens-bar.md` — Screen thumbnails + navigation (bottom bar)
- [ ] `13-templates.md` — 5 pre-built screenshot layouts

### Phase 4: Polish
- [ ] `15-keyboard-shortcuts.md` — Cmd+Z, copy/paste, delete, zoom, nudge
- [ ] `16-persistence.md` — IndexedDB save/load + auto-save
- [ ] `17-globals-settings.md` — Shared defaults across screens

## Dependency Map

```
01 Project Setup
 └──> 02 Types & Dimensions
       └──> 03 Zustand Stores
             └──> 04 Canvas Wrapper
                   ├──> 05 Background ──> 06 Text ──> 07 Device Frames
                   │                  ──> 12 Image & Shapes
                   ├──> 08 Properties Panel (needs 05, 06, 07)
                   ├──> 09 Layers Panel
                   ├──> 11 Screens Bar
                   └──> 14 Export (needs 02 dimensions)
             ├──> 10 Toolbar (needs 03 stores)
             └──> 15 Keyboard Shortcuts (needs 03 stores)

13 Templates (needs 05, 06, 07, 09)
16 Persistence (needs 02, 03)
17 Globals (needs 03, 05, 06, 07)
```

## Parallelization Opportunities

After Task 04 (Canvas Wrapper) is done, these can run in parallel:
- **Track A**: 05 → 06 → 07 → 13 (visual layers → templates)
- **Track B**: 12 (image & shapes, independent)
- **Track C**: 09, 10, 11 (UI panels, mostly independent)
- **Track D**: 14 (export, depends on 02 + 04)
- **Track E**: 15, 16 (keyboard + persistence, depends on 03)

Task 08 (Properties Panel) should come after most layer types are done (05, 06, 07).

## PRD Coverage

| PRD Feature | Task(s) |
|---|---|
| Canvas Editor (layers, interactions) | 04, 09 |
| Text Styling | 06 |
| Background Designer | 05 |
| Device Frames | 07 |
| Image Layers | 12 |
| Shape Layers | 12 |
| Templates (5 presets) | 13 |
| Project Management (screens, globals) | 03, 11, 17 |
| Export (single + batch + ZIP) | 14 |
| Undo/Redo | 03, 10, 15 |
| Keyboard Shortcuts | 15 |
| Persistence (IndexedDB) | 16 |
| Google Fonts | 06 |
| Color Picker + Gradients | 05 |

**All PRD MVP features are covered.**

## Total Estimated Time: 32–35 hours
