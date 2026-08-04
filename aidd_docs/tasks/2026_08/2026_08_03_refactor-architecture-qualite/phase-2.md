---
status: done
---

# Instruction: Historique objet sans sérialisation

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── src/
    └── stores/
        ├── history.store.ts              ✏️ piles de HistorySnapshot et coalescence typée
        ├── canvas.store.ts               ✏️ construction/restauration des snapshots objet
        └── __tests__/
            └── history.store.test.ts     ✅ undo/redo, coalescence et limite
```

## Tasks to do

### `1)` Stocker des snapshots objet

> Retirer `JSON.stringify` et `JSON.parse` du chemin de chaque édition.

1. Définir les variantes `screen` et `project` de `HistorySnapshot` dans le domaine historique.
2. Passer `past`, `future`, `record`, `undo` et `redo` aux objets typés.
3. Comparer les références métier internes pour éviter un doublon sans sérialiser le contenu.

### `2)` Construire et restaurer les snapshots au point d’usage

> Garder le store d’historique indépendant du project store.

1. Construire le pre-state écran ou projet dans `canvas.store.ts`.
2. Exclure les thumbnails des snapshots projet sans cloner les tableaux de calques.
3. Restaurer avec `structuredClone` uniquement au moment d’un undo/redo.
4. Supprimer `serializeScreen`, `serializeProject`, `parseSnapshot` et toute compatibilité string.

### `3)` Verrouiller la sémantique de coalescence

> Conserver exactement le premier pre-state d’un burst de 1200 ms.

1. Tester même clé dans la fenêtre, clés différentes et fenêtre expirée avec les fake timers Vitest.
2. Tester undo/redo vide, invalidation du futur après record et `maxHistory`.
3. Tester qu’un snapshot aux mêmes références métier n’ajoute pas de pas.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Mille appels d’édition n’appellent aucun `JSON.stringify` depuis le chemin d’enregistrement de l’historique. |
| 2 | Undo puis redo restaurent les calques, le background et l’écran actif sans partager de références mutables avec le snapshot. |
| 3 | Un burst de nudges avec la même clé crée un seul pas et restaure le premier pre-state. |
| 1–3 | Les specs E2E de coalescence et de transformations restent vertes. |
