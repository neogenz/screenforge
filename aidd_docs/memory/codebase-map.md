# Codebase Map

```mermaid
flowchart TD
    Entry["src/main.tsx"] --> App["src/App.tsx"]
    App --> Components["src/components"]
    Components --> Hooks["src/hooks"]
    Hooks --> Stores["src/stores"]
    Stores --> Lib["src/lib"]
    App --> Assets["src/assets"]
    Tests["src/**/__tests__ and e2e"] --> App
```

## Areas

- `src/components/`: editor chrome, canvas integration, feature panels, dialogs, and UI primitives.
- `src/hooks/`: canvas lifecycle, keyboard behavior, export orchestration, fonts, and layer actions.
- `src/stores/`: project, canvas, history, UI, and toast state domains.
- `src/lib/`: persistence, export, project-file, asset, dimension, and shared domain logic.
- `src/assets/`: device-frame definitions, templates, and gradient presets.
- `src/types/`: shared project and layer model.
- `e2e/`: browser-level editor and pixel-exact export contracts.
- `scripts/`: export validation, contrast audit, and visual probes.
- `aidd_docs/tasks/`: scoped specs, plans, phases, and reviews for completed and active work.

## Entry points

- `src/main.tsx`: mounts React and exposes development-only test handles.
- `src/App.tsx`: initializes persistence and composes the single editor workspace.
- `src/lib/export.ts`: render/export critical path.
- `src/lib/storage.ts`: IndexedDB lifecycle and autosave boundary.
