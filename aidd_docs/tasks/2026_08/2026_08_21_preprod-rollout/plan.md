---
objective: "La branche preprod déploie automatiquement le même candidat testé sur Vercel et Convex, puis les parcours Cloud et les garde-fous fournisseurs sont prouvés sans activer la production."
status: in-progress
---

# Plan: Livrer et valider la préproduction

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Intégrer l'automatisation déjà implémentée, promouvoir `main` vers `preprod` et produire les preuves hébergées nécessaires avant tout travail de production. |
| **Source** | Demande utilisateur du 2026-08-21 après le merge de la PR #18, complétée par l'état GitHub et les plans AIDD `preprod-ci-automation` et `preprod-hardening-cloud-quota-ux`. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Intégrer l'automatisation préproduction | [`phase-1.md`](./phase-1.md) |
| 2 | Protéger et promouvoir la branche preprod | [`phase-2.md`](./phase-2.md) |
| 3 | Prouver les parcours Cloud et les limites opérateur | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://docs.github.com/en/pull-requests/concepts/deploying-code | Les rulesets, checks requis et restrictions d'Environment forment des contrôles distincts et complémentaires. |
| https://docs.convex.dev/cli/deploy-key-types | `CONVEX_DEPLOY_KEY` permet un déploiement CI non interactif et peut être borné à un déploiement et aux permissions nécessaires. |
| https://docs.convex.dev/production/usage-limits | Les warnings sont non bloquants ; un disable coupe le déploiement jusqu'à la fin de la fenêtre ou à une modification du seuil. |
| https://vercel.com/docs/git | Un push sur une branche Preview connectée déclenche automatiquement son déploiement Vercel. |
| https://vercel.com/docs/deployments/generated-urls | L'URL de branche reste stable et pointe vers le dernier déploiement de cette branche. |
| https://vercel.com/docs/deployment-protection | Standard Protection et Vercel Authentication protègent les URLs Preview, pas un futur domaine de production public. |
| https://polar.sh/docs/features/products | Le produit, son cycle de facturation et les informations visibles au checkout doivent être validés dans Sandbox. |
| https://resend.com/docs/dashboard/emails/introduction | Une preuve d'envoi hébergé doit être contrôlée dans le journal Resend, pas déduite d'un test simulé. |

## Decisions

| Decision | Why |
| -------- | --- |
| Réutiliser `codex/preprod-ci-automation` au lieu de réécrire son workflow. | Les deux commits existent déjà, sont poussés et disposent d'un audit de configuration dédié. |
| Conserver Vercel Git comme seul producteur du frontend préproduction. | Vercel déploie nativement chaque push de `preprod`; un second déploiement Actions créerait deux producteurs concurrents. |
| Promouvoir uniquement un arbre `preprod` identique à `main`. | Le candidat hébergé doit correspondre exactement au code revu, malgré le commit d'initialisation propre à la branche longue durée. |
| Garder les disables Convex inactifs pendant le rollout. | Aucun historique fiable ne permet encore de choisir un seuil dur sans risque de couper la préproduction. |
| Exclure la production de ce plan. | Le domaine final et les validations fournisseur de production ne sont pas disponibles ; aucun tag, paiement réel ou secret production ne doit être utilisé. |
