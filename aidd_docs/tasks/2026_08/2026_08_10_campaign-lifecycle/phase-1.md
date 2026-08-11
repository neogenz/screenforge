---
status: done
---

# Instruction: modèle versionné et transaction éditoriale

## Architecture projection

```txt
apps/web/src/lib/
├── editor-transaction.ts                  ✅ la mutation multi-écrans, tout ou rien
├── project-file.ts                        ✏️ plancher/plafond de version au lieu d'une égalité
└── __tests__/editor-transaction.test.ts   ✅ 12 cas
apps/web/e2e/
└── project-file.spec.ts                   ✏️ 3 cas de version au lieu d'un
```

## Ce que le dépôt savait déjà faire

Rien n'a été réimplémenté. `history.store` porte déjà une capture de type
`project` et `canvas.store` sait la restaurer (`persistProject`) : la
transaction s'y branche au lieu d'ouvrir une seconde voie d'annulation.
`collectAssetIds` sert au diff d'assets sans être modifié.

## Tasks to do

### `1)` La primitive de transaction

> Un lot préparé à côté, validé, publié en une écriture

1. `runEditorTransaction(mutate)` : clone → mutation sur le brouillon →
   `isProject` → une capture d'historique → une référence de projet
2. `ABORT` renvoyé par la mutation, ou une exception levée : rien n'est écrit
3. L'identité (`id`, `createdAt`) n'appartient pas au rédacteur ; `updatedAt`
   passe par `nextTimestamp`, ce qui garde la synchronisation monotone
4. `activeScreenId` retombe sur un écran survivant si le lot a supprimé le sien
5. La sélection perd les calques disparus et garde les autres

### `2)` Le balayage des assets, délibérément absent

1. La transaction **rend** `addedAssetIds` / `orphanedAssetIds` sans rien
   supprimer
2. Motif écrit dans le fichier : une capture d'historique antérieure référence
   encore l'asset orphelin, et l'effacer ferait d'une annulation un calque au
   contenu manquant. Le balayage n'est correct qu'au chargement, là où
   `storage.ts:206` le fait pendant que la pile d'annulation vient d'être vidée

### `3)` Le format portable accepte son passé, refuse son futur

1. `MIN_READABLE_PROJECT_FILE_VERSION` et `PROJECT_FILE_VERSION` remplacent le
   test d'égalité de `parseManifest`
2. `PROJECT_FILE_VERSION` reste à `1` : aucun discriminant nouveau n'est encore
   écrit, et livrer un `2` que rien ne distingue d'un `1` rendrait illisibles
   par les binaires précédents des archives identiques. Le numéro monte en
   phase 3, dans le commit qui ajoute le calque `icon`

## Test acceptance criteria

| Task | Acceptance criteria                                                                      |
| ---- | ---------------------------------------------------------------------------------------- |
| 1    | Deux écrans modifiés ensemble : `past` a une entrée, une annulation restaure les deux    |
| 1    | `ABORT`, exception, brouillon invalide, identifiant de calque dupliqué : `project` reste la même référence |
| 2    | Un asset remplacé sort en `orphanedAssetIds` et reste résoluble                          |
| 3    | Versions `2`, `0` et `1.5` → `unsupported-version` ; une archive `1` s'ouvre             |

> Ligne 3 dépassée par la suite : le plafond est passé à 5 aux phases 3, 5 et 8,
> donc `2` s'ouvre désormais. Ce qui restait à tenir — refuser une version
> postérieure au plafond, ouvrir tout ce qui est en deçà — est mesuré à chaque
> phase qui bouge le plafond, et `project-file.spec.ts` refuse `6`, `0` et `1.5`.
> Conservée telle quelle : elle dit ce qui a été vérifié ce jour-là.

## Résultats

```
vitest run src/lib/__tests__/editor-transaction.test.ts   12 passed
pnpm run test:unit                                        171 passed (25 + 4 fichiers)
pnpm run typecheck                                        Done
pnpm run lint                                             clean
playwright test project-file                              6 passed
```
