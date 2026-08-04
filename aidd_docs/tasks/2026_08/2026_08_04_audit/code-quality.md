# Codebase Audit: code quality
La base est lisible, strictement typée et largement sans dette accidentelle ; les écarts importants sont concentrés aux frontières de données et d’erreur.

- **Date**: 2026-08-04
- **Scope**: `src/`, scripts et configuration TypeScript/ESLint
- **Health**: good
- **Findings**: 0 critical, 2 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
|---|---|---|---|---|---|
| 🟡 | code-quality | `src/lib/storage.ts:109` | `normalizeLayer` vérifie seulement l’objet et son discriminant, puis force `Partial<Layer>` en `Layer`. Un enregistrement IndexedDB avec dimensions absentes, opacité invalide ou propriétés de type manquantes devient donc un projet prétendument valide, alors que l’import portable possède déjà un validateur strict distinct. | Extraire les validateurs purs déjà présents dans `project-file.ts` vers un module de domaine partagé, puis les utiliser pour l’archive et IndexedDB en conservant explicitement les migrations v1→v2. Aucun nouveau package de schéma n’est nécessaire. | M |
| 🟡 | code-quality | `src/hooks/use-fonts.ts:151` | Une promesse de chargement en échec reste dans `fontPromises`. Une coupure Google Fonts ponctuelle rend donc la même famille/graisse non retentable jusqu’au rechargement de l’application. | Supprimer la clé du cache lorsque le résultat est `fallback`, ou ne mémoriser que les chargements réussis ; ajouter un test de retry après échec. | S |
| 🟢 | code-quality | `src/types/index.ts:3` | `LayerType` contient `background`, qui n’existe dans aucune branche de l’union `Layer`, et `ShapeLayer.gradientFill` double `fill: string | GradientFill` sans être lu. Ces états impossibles brouillent le contrat du modèle. | Retirer `background` de `LayerType` et le champ `ShapeLayer.gradientFill` après vérification/migration des anciens projets. | S |

## Top actions

1. Résoudre le finding code-quality #1 avec `aidd-dev:07-refactor` : unifier la validation du modèle projet entre IndexedDB et fichier portable.
2. Résoudre le finding code-quality #2 avec `aidd-dev:08-debug` : rendre les chargements de police retentables après un échec transitoire.
3. Résoudre le finding code-quality #3 avec `aidd-dev:07-refactor` : supprimer les variantes de modèle impossibles ou orphelines.

## Coverage

- **Scanned**: code-quality — 14 827 lignes TS/TSX/CSS, types, stores, persistence, imports de fichiers, export, erreurs, marqueurs de dette, casts et désactivations TypeScript/ESLint.
- **Skipped**: couverture dynamique par instrumentation ; le dépôt ne configure pas de provider de coverage.
