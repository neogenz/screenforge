---
status: pending
---

# Instruction: E2E déterministes

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── e2e/
    ├── helpers.ts                                ✏️ attentes store/Fabric réutilisables
    ├── canvas-editing.spec.ts                    ✏️ attentes d’édition et de ressource
    ├── canvas-transforms.spec.ts                 ✏️ convergence canvas → store → canvas
    ├── command-palette.spec.ts                   ✏️ horloge contrôlée pour la coalescence
    ├── layers-panel.spec.ts                      ✏️ assertions store et DOM réessayées
    ├── shared-layers.spec.ts                     ✏️ convergence des instances partagées
    └── smoke.spec.ts                             ✏️ undo/redo web-first
```

## Tasks to do

### `1)` Remplacer les pauses par des contrats d’état

> Attendre l’événement attendu, jamais une durée supposée suffisante.

1. Ajouter dans `helpers.ts` des helpers `expect.poll` pour calques, écran actif, sélection et objets Fabric.
2. Faire attendre les helpers d’ajout jusqu’à la présence du calque dans le projet et le canvas.
3. Remplacer les 48 `waitForTimeout` des sept fichiers par une assertion DOM, store ou Fabric précise.

### `2)` Contrôler le temps métier

> Tester la fenêtre de coalescence de 1,2 s sans ralentir la suite.

1. Installer `page.clock` avant la navigation du test concerné.
2. Avancer l’horloge au-delà de la fenêtre avant le second geste.
3. Vérifier l’historique et la position via `expect.poll` après chaque undo/redo.

### `3)` Préserver les contrats de transformation

> Garder les assertions immédiates et convergées qui détectent les dérives Fabric.

1. Lire l’état immédiatement après le geste lorsqu’il fait partie du contrat.
2. Attendre ensuite la convergence sur les valeurs attendues, sans pause arbitraire.
3. Conserver les tolérances numériques actuelles et les invariants de viewport, sélection et ownership.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `e2e/` ne contient plus aucun `waitForTimeout` et les tests attendent tous un résultat fonctionnel identifiable. |
| 2 | Le test de coalescence couvre deux entrées d’historique sans attendre 1,4 seconde réelle. |
| 3 | Rotation, resize, transfert inter-écrans, undo/redo, calques partagés et édition en place convergent sans drift sur plusieurs exécutions. |
