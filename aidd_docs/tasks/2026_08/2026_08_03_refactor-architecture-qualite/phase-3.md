---
status: done
---

# Instruction: Découpage des responsabilités du canvas

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── src/
    ├── hooks/
    │   └── use-canvas.ts                         ✏️ refs React, cycle de vie et orchestration des événements
    ├── components/canvas/
    │   ├── canvas-sync.ts                        ✅ synchronisation full/patch et rafraîchissement des polices
    │   └── canvas-interactions.ts                ✅ snapping Fabric, sélection et géométrie d’écran
    └── lib/
        ├── canvas/
        │   ├── project-diff.ts                   ✅ décision pure none/patch/full
        │   └── __tests__/
        │       └── project-diff.test.ts          ✅ changements ciblés et structurels
        └── __tests__/
            └── snapping.test.ts                  ✅ calcul existant de l’accroche
```

## Tasks to do

### `1)` Extraire la décision de synchronisation

> Tester la frontière entre patch local et réconciliation complète.

1. Déplacer `diffProjectChange` et ses helpers dans `lib/canvas/project-diff.ts` sans changer leur logique.
2. Exporter le type discriminé `ProjectChange`.
3. Couvrir changement d’un calque, background, layout, écran non actif, ajout, suppression et réordonnancement.

### `2)` Extraire les deux chemins de rendu

> Réunir la synchronisation Fabric dans un module sans dépendance React.

1. Déplacer les chemins full et patch dans `canvas-sync.ts` avec leurs entrées explicites.
2. Mutualiser le rafraîchissement post-chargement d’une police par `layerId`; conserver `use-fonts.ts` comme source du chargement et du cache Fabric.
3. Conserver la règle `objectCaching = false` et l’écrêtage par `render`, sans `clipPath` Fabric.

### `3)` Extraire les adaptateurs d’interaction

> Sortir du hook les calculs Fabric qui ne dépendent pas de React.

1. Déplacer boîtes, cibles, guides, écran sous le pointeur et cadre de sélection dans `canvas-interactions.ts`.
2. Laisser `use-canvas.ts` posséder les refs, abonnements, événements, zoom/pan et leur cleanup.
3. Réexporter les types publics existants pour ne pas déplacer les consommateurs.

### `4)` Vérifier le comportement réel

> Le découpage doit être neutre pour l’éditeur et l’export.

1. Tester `computeSnap` sur bords, centres, seuil et priorité de cible.
2. Exécuter la suite E2E complète après le déplacement de code.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Un changement local éligible produit un patch ciblé ; tout changement structurel produit une synchronisation complète. |
| 2 | Les chemins full et patch rendent les mêmes objets, ordre, écrêtage et sélection qu’avant le découpage. |
| 3 | `use-canvas.ts` ne contient plus la logique de diff, les boucles de synchronisation full/patch ni les calculs de snapping/sélection. |
| 4 | Drag, transfert inter-écrans, texte, shared layers, zoom et export passent sans modification des attentes E2E. |
