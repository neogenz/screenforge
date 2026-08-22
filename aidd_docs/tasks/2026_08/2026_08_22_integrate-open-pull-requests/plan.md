---
objective: "Les travaux de #23, #26, #22 et #24 sont intégrés sans perte dans un main vert, le même arbre est validé en préproduction, et la release reste bloquée tant que ses prérequis réels manquent."
status: in-progress
---

# Plan: Intégrer les pull requests ouvertes sans casser le produit

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Livrer les travaux dans un ordre contrôlé, poser la refonte coss avant les nouvelles plateformes, résoudre les contrats Android/Apple une seule fois et conserver une préproduction récupérable. |
| **Source** | Demande utilisateur du 2026-08-22, complétée par l’état GitHub des PR #6, #22, #23, #24, #25 et #26 et des simulations Git sans mutation. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Figer le point de reprise préproduction | [`phase-1.md`](./phase-1.md) |
| 2 | Intégrer PostHog et les pages légales sans activer un traitement incomplet | [`phase-2.md`](./phase-2.md) |
| 3 | Intégrer la refonte coss UI comme nouvelle fondation frontend | [`phase-3.md`](./phase-3.md) |
| 4 | Poser Android comme contrat multi-store générique | [`phase-4.md`](./phase-4.md) |
| 5 | Unifier les contrats Android et Apple | [`phase-5.md`](./phase-5.md) |
| 6 | Porter les surfaces iPad et Apple Watch sur le contrat unifié | [`phase-6.md`](./phase-6.md) |
| 7 | Promouvoir et qualifier le candidat combiné | [`phase-7.md`](./phase-7.md) |
| 8 | Rafraîchir la release sans contourner le gate production | [`phase-8.md`](./phase-8.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/neogenz/screenforge/pull/25 | Promotion `main` vers `preprod`, mergeable et entièrement verte avant son merge. |
| https://github.com/neogenz/screenforge/pull/23 | Observabilité et pages légales, mergeable mais derrière `main`; l’activation PostHog reste bornée par des preuves fournisseur. |
| https://github.com/neogenz/screenforge/pull/26 | Refonte coss UI, 219 fichiers; 15 fichiers partagés avec #23, 48 avec #22 et 35 avec #24 sur les bases observées. |
| https://github.com/neogenz/screenforge/pull/22 | Support Android, 147 fichiers, contrat `StoreTargetProfile` générique et CI verte sur son ancienne base. |
| https://github.com/neogenz/screenforge/pull/24 | Support iPad/Watch, 109 fichiers, contrat App Store concurrent et revue approuvée sur son ancienne base. |
| https://github.com/neogenz/screenforge/pull/6 | Release Please générée, à conserver en draft avant le domaine et la production; son check format échoue sur le manifeste généré. |

## Decisions

| Decision | Why |
| --- | --- |
| Promouvoir #25 avant les features. | La première exécution post-merge du pipeline préproduction fournit un point de reprise connu avant les intégrations à fort conflit. |
| Intégrer #23 avant les changements de profils, tout en laissant PostHog désactivé sans configuration et sans consentement. | La feature est presque orthogonale; ses trois conflits avec Android sont petits et l’absence de preuve de rétention ne doit pas devenir une activation implicite. |
| Intégrer #26 juste après #23 et avant #22/#24. | La refonte remplace la fondation et les compositions UI; porter Android et les surfaces Apple après elle évite de migrer deux fois leurs nombreux écrans partagés. |
| Garder `StoreTargetProfile` et le champ projet `target` de #22 comme contrat persistant unique. | Ce modèle couvre plusieurs stores; #24 est App Store-spécifique et peut l’enrichir sans créer un second axe `profileId`. |
| Porter #24 en deux passes plutôt que résoudre 87 conflits par choix global `ours/theirs`. | Les deux branches changent indépendamment géométrie, stockage, export, releases, UI, MCP et documentation; une résolution mécanique perdrait des comportements validés. |
| Garder #6 en draft jusqu’aux prérequis production. | Une release crée le tag immuable et déclenche le chemin production, lequel est volontairement inactif sans domaine, email, Polar et configuration finale. |
