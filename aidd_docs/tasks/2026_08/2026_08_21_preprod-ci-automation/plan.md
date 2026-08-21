---
objective: "Chaque push autorisé sur preprod valide le candidat complet, déploie Convex préproduction avec une clé bornée et termine par un preflight vert, tandis que Vercel conserve son alias de branche stable."
status: in-progress
---

# Plan: Automatiser la livraison de la préproduction

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter un déploiement Convex préproduction strictement conditionné par la CI du même SHA, sans dupliquer le déploiement frontend assuré par Vercel Git. |
| **Source** | Demande utilisateur du 2026-08-21 : rendre la branche `preprod` autonome après merge ou push. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Verrouiller et automatiser le déploiement Convex | [`phase-1.md`](./phase-1.md) |
| 2   | Borner les accès et prouver le parcours hébergé | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax | `needs` empêche le job de déploiement de démarrer lorsqu'un contrôle requis échoue ou est ignoré. |
| https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/deploy-to-environment | Un GitHub Environment borne les secrets et les branches autorisées d'un job de déploiement. |
| https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets | Un ruleset peut imposer pull request, checks stricts, résolution des discussions et méthode de merge sur `preprod`. |
| https://docs.convex.dev/cli/reference/deploy | `CONVEX_DEPLOY_KEY` sélectionne la cible en CI et `convex deploy` pousse schéma, fonctions et index. |
| https://docs.convex.dev/cli/deploy-key-types | Une clé de déploiement peut être limitée au seul déploiement préproduction et aux permissions nécessaires à la CI. |
| https://vercel.com/docs/git | L'intégration Git Vercel déploie chaque push de branche Preview sans GitHub Action supplémentaire. |
| https://vercel.com/docs/deployments/generated-urls | L'alias de branche reste stable et pointe vers son dernier déploiement Vercel. |

## Decisions

| Decision | Why |
| -------- | --- |
| Conserver Vercel Git comme unique chemin frontend de `preprod`. | Ajouter un déploiement Vercel dans Actions créerait deux producteurs concurrents pour le même alias sans améliorer le besoin actuel. |
| Ajouter le job Convex dans `Quality` plutôt que créer un workflow séparé. | Le job dépend directement des cinq preuves existantes et déploie ainsi le SHA effectivement testé. |
| Refuser le déploiement si l'arbre Git de `preprod` diffère de celui de `origin/main`. | La branche peut garder son commit d'initialisation tout en garantissant que la préproduction expose exactement le candidat courant de `main`. |
| Stocker une clé Convex dédiée dans l'Environment GitHub `preproduction`. | Le secret reste indisponible aux pull requests et ne peut viser ni le local ni la production. |
| Protéger `preprod` par pull request avec merge commit, sans approbation obligatoire. | Les checks précèdent le mouvement de l'alias Vercel, l'ascendance de `main` reste intacte et le coût humain reste adapté à un dépôt indie. |
