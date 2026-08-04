---
status: pending
---

# Instruction: Dépendances sûres et ZIP différé

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── package.json                                  ✏️ versions directes corrigées
├── pnpm-lock.yaml                                ✏️ graphe transitif régénéré
└── src/lib/
    ├── project-file.ts                           ✏️ JSZip importé à la demande
    └── zip.ts                                    ✏️ JSZip importé à la demande
```

## Tasks to do

### `1)` Corriger Vite, Fabric et le graphe transitif

> Sortir des plages vulnérables sans changement de stack.

1. Mettre Vite sur le dernier patch compatible 8.x disponible, jamais sous 8.0.16.
2. Mettre Fabric à 7.4.0 ou au dernier patch compatible 7.x.
3. Régénérer le lockfile et mettre à jour les outils directs uniquement si un avis transitif reste corrigible ainsi.
4. N’utiliser un override ciblé qu’après avoir confirmé qu’aucune mise à jour directe ne résout l’avis.

### `2)` Revalider l’intégration Fabric privée

> Vérifier les contrôles, le rendu et l’export après le patch Fabric.

1. Compiler les types des patches de contrôles.
2. Vérifier sélection, rotation, resize, clip de rendu et calques partagés.
3. Vérifier les PNG 1320×2868 opaques et leur ZIP.

### `3)` Sortir JSZip du démarrage

> Charger l’archiveur seulement lorsqu’un utilisateur importe ou exporte un fichier.

1. Remplacer les imports statiques de JSZip par `import('jszip')` dans les trois opérations ZIP.
2. Conserver les signatures publiques et les limites d’archive actuelles.
3. Vérifier qu’un chunk ZIP séparé est produit par Vite.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `pnpm audit` ne remonte plus les 22 avis de l’audit et aucune dépendance majeure n’a été introduite. |
| 2 | Les interactions Fabric et l’export pixel-exact produisent les mêmes résultats qu’avant la mise à jour. |
| 3 | Le chargement initial ne demande pas le chunk JSZip; la première action projet/export le charge et les archives restent lisibles. |
