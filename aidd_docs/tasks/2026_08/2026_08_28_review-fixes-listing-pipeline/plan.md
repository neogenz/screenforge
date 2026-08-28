---
objective: "Refermer les 35 constats de la revue de PR #30 (6 avertissements, 29 mineurs) sans changer ce que l'interface promet, le compromis des témoins d'état restant tel quel."
status: implemented
---

# Plan: Corriger la revue de « Finir la chaîne fiche → langues → version figée → App Store Connect »

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Zéro avertissement et zéro mineur restant dans `review.md`, à diff minimal, chaque correction tenue par un test ou une assertion existante |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_27_finish-listing-pipeline/review.md` (verdict `changes-requested`, 0 critique / 6 avertissements / 30 mineurs) + décision utilisateur du 28 août 2026 : le mineur `fit` sur `TOP_BAR_LABELS_MIN_WIDTH` (1424 → 1680) est accepté, ne pas modifier |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Fiche et publication — relecture sûre, séquencement des lectures Apple, bornes du brief | [`phase-1.md`](./phase-1.md) |
| 2   | Langues et rédacteur — un état par tâche, un seul chemin de traduction, requêtes bornées | [`phase-2.md`](./phase-2.md) |
| 3   | Pont — `textTurn` typé par son schéma, listes `asc` bornées et bavardes | [`phase-3.md`](./phase-3.md) |
| 4   | Gabarits — la direction portée, les constantes des archétypes partagées | [`phase-4.md`](./phase-4.md) |
| 5   | Barre du haut, spec responsive et mémoire projet | [`phase-5.md`](./phase-5.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| `updateListing` devient un correctif partiel (`Partial<ProjectListing>`) qui fusionne sur le brief courant, pose les défauts et tronque aux bornes `MAX_LISTING_*` | Deux boîtes fabriquaient chacune le brief entier et ses défauts ; le store est le seul écrivain, donc le seul endroit où la validité (`isListing`) peut être garantie avant qu'une transaction ne la constate |
| Les requêtes payantes passent par une réserve de 2 travailleurs (`mapPool` dans `lib/ai/text.ts`), jamais par `Promise.all` nu | Même règle que `use-export.ts` : un 429 sur une requête ne doit pas rejeter dix langues, et un lot ne doit pas ouvrir trente connexions |
| Le compromis `TOP_BAR_LABELS_MIN_WIDTH` = 1680 est conservé | Décision utilisateur : le comportement convient |
