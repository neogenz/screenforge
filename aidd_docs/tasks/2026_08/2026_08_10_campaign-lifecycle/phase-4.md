---
status: done
---

# Instruction: le lot de captures est une opération, pas dix

## Architecture projection

```txt
apps/web/src/
├── lib/
│   ├── batch-refresh.ts                     ✅ appariement pur + `applyRefresh`
│   └── commands.ts                          ✏️ « Actualiser les captures… » dans ⌘K
├── components/
│   ├── refresh-dialog/RefreshDialog.tsx     ✅ import, plan proposé, correction, aperçu
│   └── toolbar/TopBar.tsx                   ✏️ action secondaire (se replie avec les autres)
├── stores/ui.store.ts                       ✏️ `showRefreshDialog` dans la liste des modales
└── App.tsx                                  ✏️ boîte chargée à la demande
apps/web/
├── src/lib/__tests__/batch-refresh.test.ts  ✅ 13 cas : rôles, ambiguïtés, pose, renoncement
└── e2e/batch-refresh.spec.ts                ✅ 3 cas de bout en bout
```

## Ce que le dépôt savait déjà faire

`runEditorTransaction` (phase 1) portait déjà tout le contrat d'écriture : un
clone, une validation, une capture d'historique, une référence de projet. La
phase 4 n'en écrit aucune ligne — elle l'appelle. `normalizeSlot` (phase 2)
donne la forme du rôle, et donc celle du nom de fichier. `importImageFile`
borne déjà le décodage (16 Mio, 16 Mpx, PNG/JPEG). `Dialog`, `Select` et
`Button` sont pris tels quels.

## Tasks to do

### `1)` L'appariement se calcule sans toucher au projet

1. `refreshTargets` liste les appareils dans l'ordre lu — écrans d'abord, puis
   les calques de mise en page
2. `planRefresh` associe un rôle à un fichier. Un même fichier peut servir
   plusieurs appareils : la même capture apparaît souvent sur deux planches, et
   c'est le cas normal. **Deux fichiers pour un même rôle est une ambiguïté** :
   aucun des deux n'est posé, et le tableau la montre au lieu de tirer au sort
3. Le rang que le simulateur met devant le rôle (`01_Budget.png`) est retiré
   pour un second essai. Le rang appartient à la livraison, pas au rôle
4. Un appareil sans rôle n'est **jamais** apparié automatiquement : sans
   décision de l'utilisateur, il n'y a rien à deviner
5. `assignManually` repose un appariement et recalcule ce qu'il libère

### `2)` Le décodage est tout ou rien, avant la moindre décision

`Promise.all` sur les fichiers choisis : un seul illisible rejette le lot
entier, donc aucun asset n'entre dans le registre et l'appariement précédent
reste tel quel. Accepter la moitié d'une livraison serait exactement l'état à
mi-chemin que la transaction existe pour interdire, un cran plus tôt.

Défaut trouvé en écrivant le test : une `FileList` est vivante, et remettre
`input.value` à zéro la vide avec lui. La liste est copiée avant.

### `3)` La pose ne touche que l'asset et sa mesure

`applyRefresh` écrit `screenshotAssetId` et `screenshotSize`, rien d'autre. Le
cadrage, le rôle, la géométrie, l'appareil et l'ombre restent — c'est la
promesse de la phase 2 tenue à l'échelle du lot, et le point exact où Open
Screenshot Generator remet le cadrage à zéro à chaque release. Un appareil
disparu entre l'aperçu et la confirmation annule tout le lot.

### `4)` La boîte dit ce qu'elle n'a pas su faire

Avant/après côte à côte par ligne, et une section « À vérifier » qui nomme les
fichiers sans destination, les rôles ambigus, les appareils sans fichier et
ceux sans rôle. Un lot silencieux est le pire cas : sept posés sur dix, et
l'écart se découvre dans la planche exportée.

## Test acceptance criteria

| Task | Acceptance criteria                                                                              |
| ---- | -------------------------------------------------------------------------------------------------- |
| 1    | Un fichier `budget.png` sert les deux appareils dont le rôle est `budget`                           |
| 1    | `budget.png` + `01_budget.png` ⇒ aucun posé, l'ambiguïté est nommée dans la boîte                   |
| 1    | `01_Budget.png` et `02_Réglages.png` apparient les deux rôles sans intervention                     |
| 1    | Un appareil sans rôle reste inchangé tant qu'on ne le désigne pas à la main                         |
| 2    | Un fichier corrompu dans le lot : message d'erreur, zéro capture posée, projet identique             |
| 3    | Le lot multi-écrans se défait d'un seul ⌘Z, et le zoom réglé avant est toujours là après             |
| 3    | Un identifiant de calque disparu ⇒ `committed: false`, aucune capture d'historique                   |

### `5)` Une mesure prise trop tôt, corrigée au passage

Les non-régressions ont fait tomber `responsive-chrome.spec.ts:116` deux fois
sur trois : le décentrage de la pellicule passe par un `matchMedia` que React
traite au tick suivant, et la géométrie était lue dans la foulée du
redimensionnement. La mesure rendait donc la mise en page d'avant — 27px de
chevauchement, soit exactement l'ancien défaut, sur une bande qui l'avait déjà
corrigé. Mesure mise en boucle ; la mise en page, elle, n'a pas changé.

## Ce qui n'est pas fait ici

Le manifeste (`{ rôle: fichier }`) est lu par `fileSlot` et couvert par les
tests, mais aucune interface ne le charge : il naîtra avec l'export automatisé
de la phase 9, qui est ce qui produit des noms de fichiers illisibles. La
densité responsive et l'a11y clavier des nouvelles boîtes sont groupées en
phase 10, avec celles des phases 5 à 9.

## Résultats

```
vitest run src/lib/__tests__/batch-refresh.test.ts   13 passed
pnpm run test:unit                                   207 passed (158 web + 49 api)
pnpm run typecheck                                   Done
pnpm run lint                                        clean
playwright test batch-refresh                        3 passed
pnpm run audit:scale                                 Échelles fermées
pnpm run audit:contrast                              dark 4.78:1, light 4.55:1
```
