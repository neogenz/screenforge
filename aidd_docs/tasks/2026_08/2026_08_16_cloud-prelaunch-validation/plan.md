---
objective: "Prouver sans domaine ni paiement réel que ScreenForge Cloud fonctionne de bout en bout sur Convex préproduction, Resend de test, Polar Sandbox et une Preview Vercel contrôlée, tout en gardant la v1 bloquée jusqu’aux gates explicites domaine et production."
status: pending
---

# Plan: Valider ScreenForge Cloud avant la v1

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Créer le compte propriétaire Cloud, valider les fournisseurs réels en environnement de test, publier une Preview Vercel par CI et fermer tous les gates techniques avant l’achat du domaine et la release v1. |
| **Source** | Demande utilisateur du 2026-08-16, état des branches après fusion et audit du pipeline de publication existant. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Aligner le runbook Cloud et ajouter un preflight sans fuite | [`phase-1.md`](./phase-1.md) |
| 2 | Valider Convex, Resend et le compte propriétaire en préproduction | [`phase-2.md`](./phase-2.md) |
| 3 | Valider Polar Sandbox et les entitlements réels | [`phase-3.md`](./phase-3.md) |
| 4 | Publier une Preview Vercel contrôlée par GitHub Actions | [`phase-4.md`](./phase-4.md) |
| 5 | Asserter, reviewer et fermer le gate Cloud validé | [`phase-5.md`](./phase-5.md) |
| 6 | Garder domaine, production et v1 derrière leurs gates | [`phase-6.md`](./phase-6.md) |

## Resources

| Source | Verified |
| --- | --- |
| [Vercel — GitHub integration](https://vercel.com/docs/git/vercel-for-github) | Une intégration Git native crée par défaut un déploiement à chaque push et traite la branche de production séparément; elle doublerait le workflow de release par tag déjà retenu. |
| [Vercel — Git configuration](https://vercel.com/docs/project-configuration/git-configuration) | `git.deploymentEnabled` peut désactiver les déploiements Git automatiques sans empêcher les déploiements CLI. |
| [Vercel — GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) | Le chemin CI officiel repose sur `vercel pull`, `vercel build` puis `vercel deploy --prebuilt`. |
| [Vercel — Environments](https://vercel.com/docs/deployments/environments) et [Generated URLs](https://vercel.com/docs/deployments/generated-urls) | Une Preview CLI sans `--prod` reçoit une URL Vercel exploitable avant l’achat d’un domaine. |
| [Convex — Production and staging](https://docs.convex.dev/production/overview) | Une préproduction peut utiliser un déploiement Convex fixe distinct de la production, ce qui convient aux tests provider et aux données jetables. |
| [Convex — Environment variables](https://docs.convex.dev/production/environment-variables) | Les variables et secrets sont propres à chaque déploiement et doivent être configurés côté Convex, jamais dans le bundle ni les documents. |
| [Convex — Deployment settings](https://docs.convex.dev/dashboard/deployments/deployment-settings) | Les limites, sauvegardes et restaurations se valident depuis le déploiement ciblé avant la production. |
| [Resend — `resend.dev` testing domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) | Le domaine de test permet d’envoyer uniquement à l’adresse du compte Resend; cela suffit pour créer et valider le compte propriétaire avant le domaine public. |
| [Resend — Domains](https://resend.com/docs/dashboard/domains/introduction) | L’envoi à d’autres destinataires attendra un domaine vérifié avec SPF et DKIM; DMARC sera ajouté lors du gate domaine. |
| [Polar — Sandbox](https://polar.sh/docs/integrate/sandbox) | Sandbox isole organisations, produits, jetons et webhooks de la production et permet un checkout complet avec une carte de test. |
| [Polar — Webhooks](https://polar.sh/docs/integrate/webhooks/endpoints) et [Customer state](https://polar.sh/docs/integrate/customer-state) | Un endpoint Sandbox signé et l’événement `customer.state_changed` permettent de prouver attribution, renouvellement et révocation de Cloud sans paiement réel. |

## Decisions

| Decision | Why |
| --- | --- |
| GitHub Actions reste l’unique autorité de déploiement; l’intégration Git native Vercel n’est pas connectée avant la v1 et les auto-déploiements Git sont désactivés dans `vercel.json`. | Le dépôt possède déjà un pipeline contrôlé par tag. Une seconde autorité publierait des pushes ordinaires, créerait des doublons et rendrait les preuves de release ambiguës. |
| La première validation utilise le déploiement Convex de préproduction fixe et `onboarding@resend.dev`, puis une Preview Vercel sans domaine. | Cela prouve auth, stockage, sync et email sans achat DNS ni configuration irréversible. |
| Polar reste strictement en Sandbox jusqu’au gate production; aucun KYC, compte bancaire ou paiement réel n’est requis pour fermer le gate Cloud validé. | Sandbox couvre le contrat technique complet tout en isolant argent et clients réels. |
| Le compte propriétaire reçoit une dérogation Cloud complémentaire via la mutation interne existante, sans rôle administrateur ni produit Polar artificiel. | Le compte se comporte comme un client Cloud complet, mais le droit ne peut être créé ou modifié par le frontend. |
| Les secrets restent uniquement dans GitHub Environments, Convex, Vercel, Polar et Resend; les preuves versionnées ne contiennent que noms de variables, états, identifiants publics tronqués et URLs publiques. | Le dépôt et `aidd_docs/` sont publics; une preuve opérationnelle ne doit jamais devenir un coffre-fort. |
| Le workflow Preview est manuel et déploie un commit immuable de `main` vers l’environnement GitHub `preproduction`. | Il donne un environnement réel reproductible sans transformer chaque PR ou push en déploiement externe. |
| La Preview met à jour les origines et URLs publiques du Convex de préproduction avec son URL exacte après déploiement. | Auth, CORS et retour de checkout doivent partager la même origine; les URLs Vercel générées changent entre déploiements. |
| La PR Release Please v1 reste en brouillon et aucun tag n’est créé avant les gates `GO DOMAIN` puis `GO PRODUCTION`. | Fusionner cette PR créerait la release et déclencherait le pipeline de production avant la validation Cloud demandée. |
