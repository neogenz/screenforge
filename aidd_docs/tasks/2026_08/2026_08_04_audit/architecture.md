# Codebase Audit: architecture
L’architecture local-first et les stores par domaine sont adaptés au produit ; la principale simplification consiste à restaurer une seule représentation réactive du projet.

- **Date**: 2026-08-04
- **Scope**: architecture React/Zustand/Fabric, frontières de modules et flux de données
- **Health**: good
- **Findings**: 0 critical, 2 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
|---|---|---|---|---|---|
| 🟡 | architecture | `src/stores/canvas.store.ts:21` | `layers` et `activeScreenId` recopient une partie de `project.store`, puis plus de dix chemins doivent muter/synchroniser les deux stores manuellement. Le projet documente pourtant `project.store` comme source de vérité ; toute nouvelle action directe du store projet peut laisser les panneaux sur un miroir périmé. | Garder dans le store canvas uniquement la sélection et l’état d’interaction éphémère. Dériver écran actif et calques depuis `project.store` avec des sélecteurs stables, puis faire passer les écritures de domaine par ses actions. Migrer progressivement, sans introduire Redux, bus d’événements ou middleware supplémentaire. | M |
| 🟡 | architecture | `src/hooks/use-canvas.ts:56` | Le hook de 814 lignes gère à la fois cycle de vie Fabric, sync bidirectionnelle, transferts inter-écrans, sélection, snapping, pan/zoom, resize, thème et génération de vignettes. Les helpers de rendu sont déjà extraits, mais le câblage restant forme plusieurs machines d’état dans un seul effet. | Extraire trois installateurs simples retournant leur cleanup : interactions/sélection, viewport, vignettes. Conserver un seul propriétaire de l’instance Fabric et éviter classes ou framework d’événements. | M |
| 🟢 | architecture | `src/stores/canvas.store.ts:11` | Les dépendances pointent parfois vers le haut : des stores/lib importent des constantes ou services depuis `components/canvas` et `hooks/use-fonts`, tandis que `export.ts` réutilise aussi le rendu situé dans `components`. Les modules sont purs mais rangés comme UI, ce qui masque la vraie frontière. | Déplacer uniquement les briques réellement partagées vers `lib/canvas/` et `lib/fonts.ts` ; laisser les composants React en consommateurs. | M |

## Top actions

1. Résoudre le finding architecture #1 avec `aidd-dev:07-refactor` : retirer le miroir de données projet du store canvas, sans changer de bibliothèque d’état.
2. Résoudre le finding architecture #2 avec `aidd-dev:07-refactor` : découper le câblage de `useCanvas` par responsabilité avec des fonctions de cleanup plates.
3. Résoudre le finding architecture #3 avec `aidd-dev:07-refactor` : replacer les utilitaires Fabric/polices purs sous `lib/`.

## Coverage

- **Scanned**: architecture — mémoire AIDD, stores Zustand, hook Fabric, flux projet→canvas→export, persistance, historique, dépendances internes et composants les plus volumineux.
- **Skipped**: diagramme de dépendances généré automatiquement ; les imports et cycles conceptuels ont été examinés statiquement.
