---
status: done
---

# Instruction: Frontières de modules et retry des polices

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/lib/
│   ├── fonts.ts                                  ✅ chargeur et constantes de polices
│   ├── canvas/
│   │   ├── canvas-interactions.ts                ✅ helpers Fabric déplacés
│   │   ├── canvas-sync.ts                        ✅ synchronisation Fabric déplacée
│   │   ├── canvas-utils.ts                       ✅ rendu Fabric déplacé
│   │   ├── controls-patch.ts                     ✅ patch Fabric déplacé
│   │   └── __tests__/controls-patch.test.ts      ✅ test déplacé
│   ├── __tests__/fonts.test.ts                   ✅ échec, retry et requêtes concurrentes
│   ├── export.ts                                 ✏️ imports lib uniquement
│   └── layer-factories.ts                        ✏️ imports lib uniquement
├── src/hooks/
│   ├── use-canvas.ts                             ✏️ imports depuis lib/canvas et lib/fonts
│   └── use-fonts.ts                              ❌ module sans hook supprimé
├── src/components/
│   ├── canvas/
│   │   ├── canvas-interactions.ts                ❌ déplacé sous lib/canvas
│   │   ├── canvas-sync.ts                        ❌ déplacé sous lib/canvas
│   │   ├── canvas-utils.ts                       ❌ déplacé sous lib/canvas
│   │   ├── controls-patch.ts                     ❌ déplacé sous lib/canvas
│   │   ├── __tests__/controls-patch.test.ts      ❌ déplacé sous lib/canvas
│   │   └── CanvasEditor.tsx                      ✏️ menu depuis le feature UI
│   ├── layers-panel/
│   │   ├── layer-menu.tsx                        ✅ menu replacé avec ses consommateurs UI
│   │   └── LayerItem.tsx                         ✏️ import local du menu
│   ├── globals-editor/GlobalsEditor.tsx          ✏️ constantes depuis lib/fonts
│   ├── template-picker/TemplatePreview.tsx       ✏️ dimensions depuis lib/canvas
│   └── text-editor/
│       ├── FontPicker.tsx                        ✏️ chargeur depuis lib/fonts
│       └── TextEditor.tsx                        ✏️ options depuis lib/fonts
├── src/lib/layer-menu.tsx                        ❌ replacé dans le feature UI
├── src/assets/templates/index.ts                 ✏️ constantes depuis lib/fonts
├── src/stores/
│   ├── canvas.store.ts                           ✏️ dimensions depuis lib/canvas
│   └── project.store.ts                          ✏️ constantes depuis lib/fonts
├── vite.config.ts                                ✏️ résolution native ESM sans `__dirname`
└── aidd_docs/memory/codebase-map.md               ✏️ frontières de modules actualisées
```

## Tasks to do

### `1)` Inverser les imports vers le domaine

> Faire dépendre composants et stores de `lib`, jamais l’inverse.

1. Déplacer les quatre modules Fabric sans JSX sous `src/lib/canvas` avec leur test.
2. Déplacer le faux hook de polices vers `src/lib/fonts.ts`.
3. Replacer le builder de menu sous `components/layers-panel`.
4. Mettre à jour les imports sans créer de barrel file.

### `2)` Rendre une police retentable

> Ne mettre en cache que les chargements utiles.

1. Conserver la déduplication d’une requête en vol.
2. Retirer `fontPromises[key]` lorsque le résultat est `fallback`.
3. Conserver les clés réussies et la purge du cache de métriques Fabric.
4. Tester un premier échec suivi d’un succès et deux appels concurrents.

### `3)` Vérifier la frontière finale

> Empêcher les couches basses de tirer React UI par accident.

1. Vérifier que `src/lib`, `src/stores` et `src/assets` n’importent plus `components` ou `hooks`.
2. Vérifier que les fichiers déplacés gardent les mêmes exports nommés.
3. Actualiser le codebase map.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Les fonctionnalités UI compilent après les déplacements et les modules domaine ne dépendent plus d’un dossier de composants ou hooks. |
| 2 | Une coupure Google Fonts produit un fallback, puis un second appel peut charger la même face sans recharger l’application; les appels simultanés restent dédupliqués. |
| 3 | Rendu, export, templates, valeurs globales et menu de calque restent identiques après la réorganisation. |
