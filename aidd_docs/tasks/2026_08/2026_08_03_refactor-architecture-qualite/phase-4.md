---
status: done
---

# Instruction: Persistance atomique et cycle des assets

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── src/
    └── lib/
        ├── assets.ts                         ✏️ lecture/commit des dirty ids et sweep cohérent
        ├── asset-refs.ts                     ✅ collecte exhaustive des assetId du projet
        ├── storage.ts                        ✏️ transactions atomiques, validation et cascade
        └── __tests__/
            ├── asset-refs.test.ts            ✅ références, partage et sweep
            └── storage.test.ts               ✅ migration, rollback, suppression et record invalide
```

## Tasks to do

### `1)` Ne nettoyer les assets dirty qu’après commit

> Un échec IndexedDB doit laisser les données en mémoire prêtes pour le prochain essai.

1. Remplacer `takeDirtyAssets()` par une lecture non destructive.
2. Marquer uniquement les ids effectivement écrits après résolution de `tx.done`.
3. Conserver les dirty ids sur toute erreur de transaction.

### `2)` Écrire projet et assets atomiquement

> Aucun projet durable ne doit référencer un asset absent.

1. Ouvrir une transaction `readwrite` couvrant `projects` et `assets`.
2. Écrire le projet normalisé et les nouveaux assets dans cette transaction.
3. En cas d’échec, aborter le commit, garder l’état mémoire et afficher le toast d’échec existant.
4. Retenter lors de la prochaine modification/autosave, sans boucle automatique infinie.

### `3)` Collecter et purger les orphelins

> Couvrir tous les porteurs actuels d’assetId et échouer au typecheck lors d’un nouveau type oublié.

1. Collecter `ImageLayer.assetId`, `DeviceFrameLayer.screenshotAssetId` et `importedBezel.assetId` sur écrans et layout.
2. Implémenter un switch exhaustif sur `Layer`.
3. Purger registre, index de longueur et dirty ids au chargement, quand l’historique est vide.
4. Supprimer projet et assets associés dans une transaction commune via l’index `by-project`.

### `4)` Définir migration et record invalide

> Réparer le legacy connu sans transformer silencieusement une valeur illisible en projet vide.

1. Accepter les champs optionnels historiques et migrer les data URLs inline vers les assets.
2. Rejeter avec une erreur typée un top-level sans identité ou collection d’écrans exploitable.
3. Lors du chargement du dernier projet, laisser le record invalide intact et choisir le record valide précédent.
4. S’il n’existe aucun record valide, laisser l’application créer un nouveau projet avec un toast informatif.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Un échec d’écriture laisse les assets concernés dirty ; la sauvegarde suivante les réécrit. |
| 2 | Si l’écriture d’un asset échoue, ni le nouveau projet ni aucun nouvel asset de la transaction ne sont committés. |
| 3 | Un asset partagé survit tant qu’une référence existe ; supprimer un projet retire immédiatement tous ses assets persistés. |
| 4 | Un projet v1 est migré sans data URL inline ; un record invalide reste inchangé et ne masque pas un projet valide plus ancien. |
