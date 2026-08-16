---
objective: "Prouver sans domaine ni paiement réel que ScreenForge Cloud fonctionne de bout en bout sur Convex préproduction, Resend de test, Polar Sandbox et des Previews Vercel de PR protégées, tout en gardant la v1 bloquée jusqu’aux gates explicites domaine et production."
status: pending
---

# Plan: Valider ScreenForge Cloud avant la v1

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Créer le compte propriétaire Cloud, valider les fournisseurs réels et relire chaque PR interne dans une Preview Vercel reliée uniquement à Convex préproduction avant l’achat du domaine et la release v1. |
| **Source** | Demande utilisateur du 2026-08-16, état des branches après fusion, audit du pipeline de publication et sous-plan `2026_08_16_vercel-pr-previews`. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Aligner le runbook Cloud et ajouter un preflight sans fuite | [`phase-1.md`](./phase-1.md) |
| 2 | Valider Convex, Resend et le compte propriétaire en préproduction | [`phase-2.md`](./phase-2.md) |
| 3 | Valider Polar Sandbox et les entitlements réels | [`phase-3.md`](./phase-3.md) |
| 4 | Exécuter le sous-plan Previews Vercel par pull request | [`phase-4.md`](./phase-4.md) |
| 5 | Asserter, reviewer et fermer le gate Cloud validé | [`phase-5.md`](./phase-5.md) |
| 6 | Garder domaine, production et v1 derrière leurs gates | [`phase-6.md`](./phase-6.md) |

## Resources

| Source | Verified |
| --- | --- |
| [Vercel — GitHub integration](https://vercel.com/docs/git/vercel-for-github) | L’intégration Git officielle crée une Preview et publie son statut pour chaque branche ou PR éligible; les forks demandent une autorisation séparée. |
| [Vercel — Git configuration](https://vercel.com/docs/project-configuration/git-configuration) | `git.deploymentEnabled` accepte des règles par branche; `main: false` laisse les autres branches produire des Previews sans empêcher les déploiements CLI. |
| [Vercel — Environments](https://vercel.com/docs/deployments/environments) et [Generated URLs](https://vercel.com/docs/deployments/generated-urls) | Chaque PR reçoit une URL Preview distincte et les variables Preview peuvent rester séparées de Production. |
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
| L’intégration GitHub officielle Vercel est l’unique autorité de Preview; GitHub Actions reste l’unique autorité de production et ne s’exécute que sur un tag SemVer valide. | Les PR obtiennent automatiquement une URL de revue sans qu’un push ou merge sur `main` puisse contourner la release vérifiée. |
| La première validation utilise le déploiement Convex de préproduction fixe et `onboarding@resend.dev`, puis une Preview Vercel sans domaine. | Cela prouve auth, stockage, sync et email sans achat DNS ni configuration irréversible. |
| Polar reste strictement en Sandbox jusqu’au gate production; aucun KYC, compte bancaire ou paiement réel n’est requis pour fermer le gate Cloud validé. | Sandbox couvre le contrat technique complet tout en isolant argent et clients réels. |
| Le compte propriétaire reçoit une dérogation Cloud complémentaire via la mutation interne existante, sans rôle administrateur ni produit Polar artificiel. | Le compte se comporte comme un client Cloud complet, mais le droit ne peut être créé ou modifié par le frontend. |
| Les secrets restent uniquement dans GitHub Environments, Convex, Vercel, Polar et Resend; une Preview ne reçoit que `VITE_CONVEX_URL`, qui est publique. | Du code de PR ne doit jamais pouvoir lire un jeton de déploiement ou un secret serveur. |
| `vercel.json` désactive seulement `main`; aucun workflow Preview, `VERCEL_TOKEN`, `pull_request_target` ou application GitHub maison n’est ajouté. | Vercel fournit déjà build, URL, statut et protection des forks; dupliquer ce chemin ajouterait une autorité inutile. |
| Convex préproduction accepte le namespace HTTPS étroit observé du projet ScreenForge via une règle partagée par CORS et les retours d’auth; production conserve uniquement ses origines exactes. | Les URLs de PR sont éphémères, mais un joker global `*.vercel.app` ouvrirait les données et codes de session à des projets tiers. |
| Le checkout Polar Sandbox reste validé sur l’origine canonique de préproduction; les Previews de PR vérifient ensuite la lecture de l’entitlement et les writes Cloud. | Une URL de retour de paiement stable ne doit pas dépendre d’une branche éphémère ni être fournie par du code de PR. |
| `verification.md` du présent plan est l’unique matrice de preuves pour les fournisseurs et le sous-plan Preview. | Une seule preuve expurgée évite les divergences entre assert, review, browser QA et état provider. |
| La PR Release Please v1 reste en brouillon et aucun tag n’est créé avant les gates `GO DOMAIN` puis `GO PRODUCTION`. | Fusionner cette PR créerait la release et déclencherait le pipeline de production avant la validation Cloud demandée. |
