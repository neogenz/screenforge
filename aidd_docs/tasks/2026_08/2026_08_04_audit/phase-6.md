---
status: done
---

# Instruction: État projet comme source unique

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/stores/
│   ├── project.store.ts                          ✏️ propriétaire de l’écran actif et sélecteurs de calques
│   ├── canvas.store.ts                           ✏️ sélection, historique et commandes sans miroir
│   └── __tests__/canvas.store.test.ts            ✅ invariants projet/canvas et undo/redo
├── src/App.tsx                                   ✏️ initialisation directe du project store
├── src/components/
│   ├── canvas/CanvasEditor.tsx                   ✏️ calques dérivés du projet
│   ├── canvas/SelectionToolbar.tsx               ✏️ sélection croisée avec le projet
│   ├── layers-panel/LayersPanel.tsx              ✏️ calques dérivés du projet
│   ├── properties-panel/BackgroundSection.tsx    ✏️ écran actif dérivé du projet
│   ├── properties-panel/PropertiesPanel.tsx      ✏️ calques dérivés du projet
│   ├── screens-bar/ScreensBar.tsx                ✏️ écran actif écrit dans le projet
│   └── toolbar/TopBar.tsx                        ✏️ compte de calques dérivé du projet
├── src/hooks/
│   ├── use-canvas.ts                             ✏️ abonnements à project.store
│   ├── use-keyboard.ts                           ✏️ opérations sur les calques projet
│   └── use-layer-actions.ts                      ✏️ lectures impératives du projet
├── src/lib/
│   ├── commands.ts                               ✏️ écran et calques lus depuis le projet
│   └── storage.ts                                ✏️ activation sans synchronisation secondaire
├── e2e/
│   ├── helpers.ts                                ✏️ contrat debug actualisé
│   ├── canvas-transforms.spec.ts                 ✏️ assertions sur project.store
│   ├── command-palette.spec.ts                   ✏️ positions lues dans project.store
│   ├── device-bezel-import.spec.ts               ✏️ calque lu dans project.store
│   └── layers-panel.spec.ts                      ✏️ calques lus dans project.store
└── aidd_docs/memory/architecture.md               ✏️ source de vérité actualisée
```

## Tasks to do

### `1)` Donner l’écran actif au project store

> Supprimer la première moitié du miroir.

1. Ajouter une action `setActiveScreenId` validée dans `project.store`.
2. Faire utiliser cette action par initialisation, filmstrip, commandes, templates et transferts canvas.
3. Retirer `activeScreenId` et `setActiveScreenId` de `canvas.store`.

### `2)` Dériver les calques du projet

> Supprimer la seconde moitié du miroir.

1. Ajouter deux helpers purs pour obtenir écran actif et combinaison calques écran/layout.
2. Retirer `layers` et `syncLayersFromProject` de `canvas.store`.
3. Faire lire les actions canvas depuis le projet au moment de l’appel, puis écrire uniquement via `project.store`.
4. Faire dériver les composants avec des sélecteurs stables et `useShallow` lorsque la liste combinée est reconstruite.

### `3)` Préserver sélection et historique

> Ne changer aucun geste utilisateur pendant la normalisation de l’état.

1. Garder `selectedLayerIds`, undo/redo et coalescence dans leurs stores actuels.
2. Nettoyer la sélection après suppression/changement d’écran et la restaurer après transfert Fabric.
3. Faire restaurer les snapshots directement dans `project.store` sans synchronisation secondaire.

### `4)` Verrouiller le nouvel invariant

> Détecter toute réintroduction d’un miroir.

1. Ajouter des tests de mutation, changement d’écran, scope layout, undo et redo.
2. Mettre à jour les assertions E2E et le contrat debug pour lire les données de domaine dans `project.store`.
3. Actualiser la mémoire d’architecture.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Changer d’écran modifie une seule valeur de domaine et recentre le bon artboard sans écran actif contradictoire. |
| 2 | Panneaux, raccourcis, palette et canvas voient immédiatement les mêmes calques après toute mutation, sans appel de synchronisation manuel. |
| 3 | Sélection, transfert inter-écrans, partage layout, undo/redo et coalescence conservent leurs résultats et ne créent qu’une entrée d’historique attendue. |
| 4 | Les tests prouvent que `canvas.store` ne contient plus de copie de l’écran actif ou des calques. |
