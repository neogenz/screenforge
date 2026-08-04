# Database

## Setup

- Browser IndexedDB database `screenforge`, schema version 2, accessed through `idb` in `src/lib/storage.ts`.
- Persistence is entirely local; there is no server database, migration service, or seed process.

## Main entities

```mermaid
erDiagram
    PROJECT ||--|{ SCREEN : contains
    PROJECT ||--o{ ASSET : owns
    SCREEN ||--o{ LAYER : contains
    LAYER }o--o| ASSET : references
```

## Conventions

- The `projects` store keys full normalized project graphs by project ID and indexes `updatedAt`; the `assets` store keys payloads by asset ID and indexes project ownership.
- Layers retain short asset IDs; the in-memory registry in `src/lib/assets.ts` deduplicates and resolves payloads on the hot path.
- Project and dirty-asset writes share one read/write transaction. Imports validate fully before atomically persisting and activating a new project copy.
- `normalizeProject` is the compatibility boundary, including v1 inline-data migration to v2 asset records; do not bypass it when loading external or legacy data.
- Autosave is debounced by two seconds and flushes on teardown; delete waits for matching in-flight saves before removing a project and its assets.
