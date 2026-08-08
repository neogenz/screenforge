# Navigation

## Routing

- ScreenForge is a single-workspace application with no client router, no URL routes and no protected areas. Sign-in, pricing and account are dialogs, not pages — the deliberate consequence of the app being one screen.
- Navigation state lives in the UI and project stores; overlays and dialogs are lazy-mounted from `src/App.tsx`.
- The only URL parameter consumed is `?checkout=success` on return from Polar; it is removed as soon as it is read.

## Structure

```mermaid
flowchart LR
    Workspace["Canvas workspace"] --> Drawers["Layers and properties drawers"]
    Workspace --> Screens["Screen filmstrip"]
    Workspace --> Overlays["Commands, templates, globals, export"]
    Workspace --> Project["Project import and download"]
```

- The top bar owns project identity, layer tools, workspace toggles, and export.
- The screen filmstrip changes the active artboard; Escape closes the nearest overlay before clearing selection.
- Keyboard commands and the command palette provide parallel navigation for editor actions.
