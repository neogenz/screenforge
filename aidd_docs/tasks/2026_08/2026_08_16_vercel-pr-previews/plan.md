---
objective: "Chaque pull request interne éligible doit recevoir une Preview Vercel protégée reliée uniquement à Convex préproduction, sans que les forks ou un push sur main puissent atteindre des secrets ou publier en production."
status: pending
---

# Plan: previews Vercel par pull request sur Convex préproduction

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Ajouter un environnement de Preview éphémère pour relire les PR ScreenForge dans des conditions Cloud réalistes, tout en conservant le tag SemVer comme unique déclencheur de production. |
| **Source** | Demande utilisateur du 2026-08-16 et plan directeur `2026_08_16_cloud-prelaunch-validation`, après clarification des environnements Local, Preview et Production. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Rendre le contrat Preview/Production exécutable | [`phase-1.md`](./phase-1.md) |
| 2 | Autoriser strictement les origines Preview dans Convex préproduction | [`phase-2.md`](./phase-2.md) |
| 3 | Activer et documenter l'intégration Git Vercel sur le dépôt public | [`phase-3.md`](./phase-3.md) |
| 4 | Prouver le parcours complet et itérer jusqu'au vert | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| --- | --- |
| [Vercel — Git configuration](https://vercel.com/docs/project-configuration/git-configuration) | `git.deploymentEnabled` accepte des règles par branche; désactiver seulement `main` laisse les autres branches produire des previews. |
| [Vercel — GitHub integration](https://vercel.com/docs/git/vercel-for-github) | L'intégration officielle publie automatiquement l'URL et le statut de Preview dans la PR et impose une autorisation aux contributions issues d'un fork. |
| [Vercel — Git deployments](https://vercel.com/docs/git) | Une branche non production produit une Preview; un projet Hobby ne peut pas déployer depuis un dépôt privé appartenant à une organisation GitHub et impose aussi des limites liées à l'auteur du commit. |
| [Vercel — Deployment Protection](https://vercel.com/docs/deployment-protection) | Standard Protection avec Vercel Authentication protège les URLs de Preview et reste disponible sur tous les plans. |
| [Convex — environment variables](https://docs.convex.dev/production/environment-variables) | Les variables sont distinctes par déploiement et leur déclaration dans `convex.config.ts` apporte validation et typage. |
| [Convex — client deployment URLs](https://docs.convex.dev/client/react/deployment-urls) | `VITE_CONVEX_URL` est une valeur frontend publique adaptée à Vite; les secrets backend ne doivent jamais passer par ce préfixe. |

## Decisions

| Decision | Why |
| --- | --- |
| Utiliser l'intégration GitHub officielle de Vercel, limitée au seul dépôt ScreenForge; ne créer ni application GitHub maison ni workflow PR porteur de `VERCEL_TOKEN`. | Vercel fournit déjà le build, l'URL et le check de PR. Retirer le jeton des workflows qui exécutent du code de PR supprime une autorité inutile et un chemin d'exfiltration. |
| Passer `git.deploymentEnabled` de `false` à une règle qui désactive uniquement `main`; conserver le workflow tagué comme seul chemin `--prod`. | Les branches obtiennent des previews sans qu'un merge sur `main` puisse contourner la release SemVer vérifiée. |
| Toutes les previews partagent le déploiement Convex préproduction existant; aucun backend Convex par PR n'est créé. | Le besoin est de valider l'intégration Cloud, pas d'exploiter une flotte de backends éphémères. Les données de préproduction restent synthétiques et nettoyables. |
| Mutualiser dans un seul helper la validation des origines utilisée par CORS et par les redirections d'authentification. | Les deux chemins protègent la même frontière. Une seule règle stricte évite qu'un correctif de CORS laisse encore fuiter un code de session par redirection. |
| Préproduction accepte uniquement le namespace HTTPS observé du projet Vercel; production conserve ses origines exactes et ne reçoit aucune configuration Preview. | Un joker `*.vercel.app` autoriserait des projets tiers. L'absence de configuration en production doit fermer cette possibilité par défaut. |
| Ne jamais autoriser directement le déploiement d'une PR issue d'un fork; après revue, reprendre le commit sur une branche interne si une Preview est nécessaire. | Fork Protection évite l'exécution de code non fiable avec l'environnement Preview. Le contributeur garde la CI sans secret et le mode Local complet. |
| Le gate `GO PUBLIC` est déjà satisfait; l’implémentation vérifie cet état sans modifier la visibilité et peut connecter l’intégration Git Vercel. | Le dépôt public est compatible avec les Previews Hobby; une régression de visibilité doit fermer l’activation plutôt que déclencher un achat implicite. |
| Garder le check Vercel informatif sur Hobby tant que les PR de bot et les auteurs autorisés n'ont pas été prouvés; les checks Quality restent les seuls checks obligatoires. | Rendre un check non disponible obligatoire bloquerait notamment une PR Release Please. Il ne devient requis qu'après preuve de couverture ou passage à une équipe Vercel compatible. |
| Écrire toutes les preuves Preview dans `verification.md` du plan Cloud directeur, sans créer une seconde série de rapports. | Les providers, l’entitlement, la Preview et la revue doivent converger vers une seule matrice publique expurgée. |
