---
status: pending
---

# Instruction: Orchestrateur Fabric découpé

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/hooks/use-canvas.ts                       ✏️ propriétaire Fabric et composition des cleanups
├── src/lib/canvas/
│   ├── install-interactions.ts                   ✅ gestes, sélection et transferts
│   ├── install-viewport.ts                       ✅ pan, zoom, resize et recentrage
│   └── install-thumbnails.ts                     ✅ génération différée et annulation
└── aidd_docs/memory/
    ├── architecture.md                           ✏️ responsabilités Fabric finales
    └── codebase-map.md                           ✏️ modules extraits documentés
```

## Tasks to do

### `1)` Extraire les miniatures

> Isoler le scheduler différé et son annulation.

1. Déplacer la capture/crop des écrans dans `install-thumbnails.ts`.
2. Retourner une fonction de planification et un cleanup qui invalide timers et générations.
3. Garder l’écriture des miniatures sans modifier `updatedAt` ni l’historique.

### `2)` Extraire les interactions

> Regrouper les événements Fabric qui forment un geste utilisateur.

1. Déplacer modification d’objet, transfert, sélection, snapping, texte en place et publication du cadre de sélection.
2. Passer seulement canvas, refs transitoires et callbacks nécessaires.
3. Retourner un cleanup qui retire listeners DOM, window, store et Fabric.

### `3)` Extraire le viewport

> Regrouper pan, zoom, resize et centrage d’écran.

1. Déplacer wheel, mode espace/molette, `ResizeObserver` et abonnements zoom/reset.
2. Conserver le budget d’un rendu par frame pour la molette et le debounce resize de 80 ms.
3. Conserver `stageInsets` comme unique géométrie du chrome.

### `4)` Réduire `useCanvas` à l’orchestration

> Garder un seul propriétaire de l’instance Fabric.

1. Laisser dans le hook la création/disposition du canvas, le runtime de sync et les abonnements projet/thème.
2. Installer les trois modules et composer leurs cleanups dans l’effet principal.
3. Ne pas ajouter de classe, service singleton, context React ou bus d’événements.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Les miniatures apparaissent après les changements, n’altèrent pas l’historique et aucune génération ne survit au démontage. |
| 2 | Sélection simple/multiple, texte en place, snapping, calques partagés et transferts inter-écrans gardent sélection, ownership et coordonnées. |
| 3 | Pan, zoom, resize, reset et recentrage de filmstrip conservent le viewport attendu et restent fluides. |
| 4 | Le montage StrictMode ne double aucun listener et l’export/rendu pixel-exact reste inchangé. |
