---
objective: "Réduire la dette d’entretien du canvas, de l’historique et du stockage sans modifier le comportement normal de l’éditeur, tout en garantissant une persistance atomique et des contrôles de release reproductibles."
status: in-progress
---

# Plan: Refonte qualité et architecture pour la commercialisation

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Découper les responsabilités critiques, supprimer les sérialisations inutiles, sécuriser les assets et installer les tests qui empêchent les régressions. |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_03_refactor-architecture-qualite/` + revue corrective du 2026-08-03. |

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Socle de tests et primitives natives      | [`phase-1.md`](./phase-1.md) |
| 2   | Historique objet sans sérialisation        | [`phase-2.md`](./phase-2.md) |
| 3   | Découpage des responsabilités du canvas   | [`phase-3.md`](./phase-3.md) |
| 4   | Persistance atomique et cycle des assets  | [`phase-4.md`](./phase-4.md) |
| 5   | Contrats Fabric, alignement et export      | [`phase-5.md`](./phase-5.md) |
| 6   | Reprise globale et gate de release        | [`phase-6.md`](./phase-6.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://vitest.dev/config/file | Vitest réutilise `vite.config.ts`; aucun fichier de configuration séparé n’est nécessaire. |
| https://github.com/jakearchibald/idb | Une transaction `idb` peut couvrir plusieurs object stores et `tx.done` confirme le commit effectif. |
| https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone | `structuredClone` couvre les données sérialisables du projet et préserve les valeurs que le clone JSON supprimait. |
| https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary | Une Error Boundary globale repose sur `getDerivedStateFromError` et `componentDidCatch`. |
| https://www.npmjs.com/package/fake-indexeddb | `fake-indexeddb` fournit IndexedDB en mémoire pour tester les transactions depuis Vitest. |

## Decisions

| Decision | Why |
| -------- | --- |
| Les snapshots d’historique deviennent des objets typés non persistés. | Le store d’historique vit uniquement en mémoire ; conserver une compatibilité avec des strings anciennes n’a aucun consommateur réel. |
| Projet et nouveaux assets sont écrits dans une seule transaction IndexedDB. | Un commit partiel peut laisser un projet durable qui référence des assets absents ; l’atomicité est une contrainte de données, pas une optimisation. |
| Les assets sont purgés au chargement d’un projet et lors de sa suppression. | Le chargement intervient avec un historique vide ; la suppression doit cascader immédiatement sans attendre une réouverture impossible. |
| Un record illisible reste intact et est ignoré au profit du dernier projet valide. | IndexedDB stocke des objets structurés, pas des blobs JSON à renommer ; préserver la valeur brute évite toute récupération destructive. |
| Le canvas est découpé par responsabilité, sans objectif arbitraire de nombre de lignes. | La frontière vérifiable est l’absence de logique de diff, de synchronisation et de géométrie dans le hook d’orchestration. |
