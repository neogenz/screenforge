---
objective: "La préproduction doit borner ses coûts et ses abus sans gêner le parcours normal, tandis que l'offre Cloud expose honnêtement ses quotas, mesure l'usage du compte et permet de libérer la copie distante sans perdre les données locales ni résilier l'abonnement."
status: in-progress
---

# Plan: durcissement préproduction et UX des quotas Cloud

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Aligner le contrat Cloud, l'UX de stockage et les garde-fous opérateur sur les limites réellement appliquées avant toute ouverture de production. |
| **Source** | Demande utilisateur du 2026-08-21, état de `main` après la finalisation Cloud et vérifications en lecture seule de la préproduction Vercel/Convex. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Unifier le contrat commercial des quotas | [`phase-1.md`](./phase-1.md) |
| 2 | Mesurer et afficher l'utilisation Cloud | [`phase-2.md`](./phase-2.md) |
| 3 | Libérer la copie Cloud sans perdre le local | [`phase-3.md`](./phase-3.md) |
| 4 | Poser les garde-fous natifs de préproduction | [`phase-4.md`](./phase-4.md) |
| 5 | Auditer et prouver le candidat avant production | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| --- | --- |
| [Convex — Usage Limits](https://docs.convex.dev/production/usage-limits) | Les seuils warning et disable sont propres à chaque déploiement; un disable coupe les fonctions jusqu'à la fin de la fenêtre ou jusqu'à modification du seuil. |
| [Convex — Abuse Protection](https://docs.convex.dev/production/abuse-protection) | Convex fournit la mitigation DDoS réseau via Cloudflare; le WAF applicatif et le bot management ne s'ajoutent que pour un besoin concret. |
| [Convex — Deployment Settings](https://docs.convex.dev/dashboard/deployments/deployment-settings) | Les limites, notifications, historiques, sauvegardes et intégrations d'observabilité se configurent par déploiement. |
| [Vercel — Deployment Protection](https://vercel.com/docs/deployment-protection) | Standard Protection avec Vercel Authentication protège les URLs de Preview et de déploiement, mais pas un futur domaine de production public. |
| [Vercel — Protection bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection) | Les shareable links, exceptions et secrets d'automation contournent l'authentification et doivent être inventoriés puis révoqués lorsqu'ils ne servent plus. |
| [Polar — Products](https://polar.sh/docs/features/products) | La description du produit apparaît au checkout et peut porter les capacités et limites achetées; les métadonnées seules ne sont pas visibles par le client. |

## Decisions

| Decision | Why |
| --- | --- |
| Les quotas commerciaux vivent dans un contrat TypeScript partagé, consommé par le backend, l'éditeur et la landing. | Les valeurs `100`, `500`, `128 Mio` et `512 Mio` sont aujourd'hui recopiées dans le serveur et les messages; une offre payante ne doit pas se contredire entre enforcement et vente. |
| Les limites sont présentées au choix de Cloud, dans le checkout Polar et dans Compte, jamais comme une friction de l'inscription gratuite. | Créer un compte n'achète rien; le consentement éclairé est nécessaire juste avant le paiement puis pendant l'usage du service. |
| L'usage est calculé à l'ouverture de Compte depuis les lignes déjà bornées, sans table d'agrégats ni abonnement temps réel supplémentaire. | Au maximum 100 projets et 500 assets sont lus ponctuellement; maintenir des compteurs transactionnels ajouterait une seconde vérité pour un volume borné. |
| La récupération v1 est une remise à zéro de toute la copie Cloud, avec conservation du compte, de l'entitlement Polar et des copies locales. | La suppression asset par asset demanderait un graphe de références inter-projets absent aujourd'hui; la remise à zéro est compréhensible, complète et réexécutable sans inventer ce graphe. |
| Une remise à zéro efface les accusés locaux de synchronisation et rétablit la barrière de consentement. | Sinon les mêmes projets seraient renvoyés automatiquement juste après leur suppression et l'action n'aurait aucun effet durable. |
| Préproduction reçoit d'abord des warnings actifs et un disable préparé mais inactif; le seuil dur n'est activé qu'après un baseline mesuré et validation du budget d'indisponibilité. | Aucun historique fiable ne permet encore de choisir un hard cap; couper tout Convex sur une valeur arbitraire serait plus risqué que l'abus qu'on cherche à borner. |
| Aucun Cloudflare/WAF supplémentaire n'est ajouté dans ce plan. | La préproduction Vercel est authentifiée, Convex fournit le socle L3/L4 et les routes coûteuses ont déjà auth, quotas et rate limits; Convex recommande un edge additionnel seulement pour un besoin applicatif observé. |
| Le deep scan est un gate ponctuel avant production et un contrôle périodique documenté, pas une GitHub Action coûteuse à chaque commit. | La CI possède déjà Gitleaks, audit de dépendances, tests d'autorisation et E2E Cloud; le scan exhaustif complète ces gates aux jalons sans rendre chaque PR impraticable. |
