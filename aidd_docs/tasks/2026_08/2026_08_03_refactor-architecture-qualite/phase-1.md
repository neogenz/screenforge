---
status: done
---

# Instruction: Socle de tests et primitives natives

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── package.json                          ✏️ scripts unitaires, Vitest et fake-indexeddb
├── pnpm-lock.yaml                        ✏️ dépendances de développement verrouillées
└── src/
    ├── lib/
    │   ├── time.ts                       ✅ nextTimestamp(previous)
    │   ├── storage.ts                    ✏️ clone natif, sans helper JSON local
    │   └── __tests__/
    │       └── time.test.ts              ✅ horloge figée et monotonie
    └── stores/
        ├── canvas.store.ts               ✏️ structuredClone + nextTimestamp
        └── project.store.ts              ✏️ structuredClone + nextTimestamp
```

## Tasks to do

### `1)` Installer le runner unitaire minimal

> Ajouter les dépendances nécessaires sans dupliquer la configuration Vite.

1. Ajouter `vitest` et `fake-indexeddb` aux devDependencies avec pnpm.
2. Ajouter `test:unit: "vitest run"` dans `package.json`.
3. Réutiliser `vite.config.ts` et son alias `@`; ne pas créer `vitest.config.ts`.

### `2)` Remplacer les clones JSON par la primitive native

> Préserver les valeurs structurées sans maintenir un clone maison.

1. Remplacer les trois `cloneValue` locaux par `structuredClone`.
2. Conserver les suppressions explicites de `thumbnail` là où elles portent une intention métier.

### `3)` Centraliser le timestamp monotone

> Nommer une règle métier répétée dans les stores.

1. Créer `nextTimestamp(previous)` avec `Math.max(Date.now(), previous + 1)`.
2. Remplacer toutes les écritures directes de cette règle dans les stores et le canvas.
3. Tester une horloge figée et une horloge déjà supérieure.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `pnpm run test:unit` découvre les tests TypeScript via la configuration Vite existante et termine avec succès. |
| 2 | Dupliquer puis muter un projet ne modifie pas sa source et conserve ses propriétés optionnelles définies à `undefined`. |
| 3 | Deux mutations dans la même milliseconde produisent des `updatedAt` strictement croissants. |
| 1–3 | Le typecheck et le lint restent verts après la substitution mécanique. |
