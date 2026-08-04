---
status: done
---

# Instruction: Modèle projet strict et compatible

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/types/index.ts                            ✏️ union Layer exacte
├── src/lib/
│   ├── project-validation.ts                     ✅ validateurs purs partagés
│   ├── project-file.ts                           ✏️ manifeste validé par le contrat partagé
│   ├── storage.ts                                ✏️ migration puis postcondition stricte
│   └── __tests__/
│       ├── project-validation.test.ts            ✅ cas valides, corrompus et legacy
│       └── storage.test.ts                       ✏️ persistance des enregistrements invalides
├── e2e/
│   ├── project-file.spec.ts                      ✏️ compatibilité archive et refus strict
│   └── device-bezel-analysis.spec.ts             ✏️ import du normaliseur partagé
└── aidd_docs/memory/
    ├── database.md                               ✏️ frontière de validation mise à jour
    └── forms.md                                  ✏️ validation de fichiers documentée
```

## Tasks to do

### `1)` Extraire le contrat de projet

> Utiliser une seule définition pour les archives et IndexedDB.

1. Déplacer les validateurs de nombres, fonds, gradients, ombres, bezels, calques et projets dans `project-validation.ts`.
2. Exporter une validation stricte sans dépendance à React, Zustand, IndexedDB ou JSZip.
3. Faire consommer ce contrat par `project-file.ts` et par la normalisation locale.

### `2)` Garder les migrations, refuser leur sortie invalide

> Compatibilité entrante permissive, modèle courant strict.

1. Conserver la migration des data URLs v1 vers le registre d’assets.
2. Migrer un ancien `ShapeLayer.gradientFill` vers `ShapeLayer.fill`, puis supprimer le champ legacy.
3. Valider le projet normalisé avant écriture ou activation; conserver intact un record local refusé et essayer le précédent.
4. Ne pas changer les versions IndexedDB ou archive puisqu’aucun format durable nouveau n’est ajouté.

### `3)` Supprimer les états impossibles

> Faire correspondre les types aux quatre calques réellement rendus.

1. Retirer `background` de `LayerType`.
2. Retirer `gradientFill` de `ShapeLayer`; conserver celui de `TextLayer`.
3. Couvrir valeurs manquantes, opacité hors plage, dimensions nulles, mauvais discriminant, doublons d’ID et forme legacy.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Une même structure invalide est refusée de façon identique depuis une archive et depuis IndexedDB. |
| 2 | Un projet v1 supporté est migré sans perte d’asset; un projet partiel/corrompu n’est ni activé ni réécrit comme valide. |
| 3 | Il est impossible de construire un `Layer` de type `background` ou une forme avec deux champs de gradient, tandis que les anciens projets supportés restent ouvrables. |
