---
objective: "Les 17 findings de l’audit sont corrigés sur feat/shadcn-migration sans changer de stack ni dégrader l’éditeur ou l’export App Store."
status: implemented
---

# Plan: Remédiation complète de l’audit ScreenForge

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les dépendances, frontières de confiance, défauts d’état, dette Fabric, outillage et retours UI relevés par l’audit. |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_04_audit/report.md` et demande utilisateur, branche `feat/shadcn-migration` à `4a02d6d`. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Outillage typé et CI | [`phase-1.md`](./phase-1.md) |
| 2 | E2E déterministes | [`phase-2.md`](./phase-2.md) |
| 3 | Dépendances sûres et ZIP différé | [`phase-3.md`](./phase-3.md) |
| 4 | Modèle projet strict et compatible | [`phase-4.md`](./phase-4.md) |
| 5 | Imports d’images bornés | [`phase-5.md`](./phase-5.md) |
| 6 | État projet comme source unique | [`phase-6.md`](./phase-6.md) |
| 7 | Frontières de modules et retry des polices | [`phase-7.md`](./phase-7.md) |
| 8 | Orchestrateur Fabric découpé | [`phase-8.md`](./phase-8.md) |
| 9 | Repli mémoire et feedback de chargement | [`phase-9.md`](./phase-9.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://react.dev/learn/choosing-the-state-structure | L’état redondant doit être dérivé de sa source au lieu d’être synchronisé manuellement. |
| https://playwright.dev/docs/best-practices | Les assertions web-first remplacent les délais fixes. |
| https://playwright.dev/docs/clock | L’horloge Playwright couvre la fenêtre de coalescence sans attente réelle. |
| https://vite.dev/releases | Une mise à jour reste dans la ligne Vite 8 supportée. |
| https://github.com/advisories/GHSA-p9ff-h696-f583 | Le correctif Vite de cette faille commence à 8.0.5 ; l’audit agrégé impose au minimum 8.0.16. |
| https://fabricjs.com/docs/upgrading/upgrading-to-fabric-70/ | Les imports nommés et API Fabric 7 actuels restent le contrat à préserver. |
| https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs | Un workflow Node unique peut exécuter la release gate existante sur GitHub. |

## Decisions

| Decision | Why |
| --- | --- |
| Conserver React 19, Zustand 5, Fabric 7, Tailwind 4, Vite 8 et IndexedDB. | L’audit ne révèle aucun motif de migration ; changer de stack augmenterait le risque sans corriger un finding. |
| `project.store` devient l’unique propriétaire du projet, de l’écran actif et des calques. | `canvas.store` ne doit conserver que sélection, historique et commandes d’interaction afin d’éliminer les états contradictoires. |
| Centraliser le décodage/validation du projet sans ajouter de bibliothèque de schéma. | Les validateurs stricts existent déjà ; leur extraction est plus petite et conserve les migrations locales. |
| Garder l’analyse de bezel sur le thread principal avec un plafond réaliste de 16 MP. | Les bezels App Store sont très inférieurs à cette limite ; un Worker ne sera ajouté que si un fichier réel valide dépasse ce plafond. |
| Les helpers Fabric purs vivent sous `src/lib/canvas`, tandis que `useCanvas` ne fait que posséder l’instance et assembler les cleanups. | Cette frontière supprime les imports domaine → composants et évite une nouvelle couche de service ou un bus d’événements. |
