---
objective: "Chaque tag SemVer de release doit être créé depuis une release approuvée, générer automatiquement le changelog puis déployer et vérifier ScreenForge sur Convex et Vercel sans exposer de secret ni publier un candidat défectueux."
status: in-progress
---

# Plan: releases taguées et déploiement Vercel par CI

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Faire de `vX.Y.Z` l'unique déclencheur de production, avec SemVer/changelog automatisés, gate qualité complet, déploiement staged, promotion contrôlée et rollback web. |
| **Source** | Demande utilisateur du 2026-08-16 et comparaison des dépôts locaux `largov2-sources`, `pulpe-workspace` et `tpc-prise-de-service`. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Aligner le runtime et durcir la CI qualité | [`phase-1.md`](./phase-1.md) |
| 2 | Automatiser SemVer, changelog, GitHub Release et tags | [`phase-2.md`](./phase-2.md) |
| 3 | Déployer Convex et Vercel exclusivement depuis un tag valide | [`phase-3.md`](./phase-3.md) |
| 4 | Configurer les protections externes et prouver la première release | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| --- | --- |
| [Node.js release schedule](https://nodejs.org/en/about/previous-releases) | Node 24 est la ligne LTS adaptée à la production en 2026; Node 26 est encore Current. |
| [Vercel — supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) | Vercel propose Node 24 par défaut et respecte `engines.node` pour sélectionner cette ligne majeure. |
| [Release Please Action](https://github.com/googleapis/release-please-action) | L'action maintient une PR de release, expose le tag/version créés et automatise changelog, version et GitHub Release depuis Conventional Commits. |
| [Release Please manifest releaser](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md) | Le mode manifest gère le paquet racine, `bootstrap-sha`, la version initiale et les sections du changelog. |
| [GitHub — `GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token) | Un tag créé avec le jeton intégré ne relance normalement pas de workflow; un jeton d'installation GitHub App est requis pour que le tag déclenche le déploiement sans PAT personnel. |
| [GitHub — create GitHub App token](https://github.com/actions/create-github-app-token) | Le jeton éphémère peut être limité au dépôt courant et aux seules permissions nécessaires. |
| [GitHub — secure use](https://docs.github.com/en/actions/reference/security/secure-use) | Les actions utilisées par une CI sensible doivent être épinglées à leur SHA complet. |
| [GitHub — environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) | Un Environment `production` borne les secrets et les refs autorisées avant l'entrée du job de déploiement. |
| [GitHub — rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) | Un ruleset de tags peut interdire création, mise à jour et suppression sauf à la GitHub App de release. |
| [GitHub — action pinning with Dependabot](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories) | Dependabot sait mettre à jour une action épinglée par SHA lorsque le commentaire de version reste sur la même ligne. |
| [Vercel — Git configuration](https://vercel.com/docs/project-configuration/git-configuration) | `git.deploymentEnabled: false` désactive les déploiements automatiques par branche et laisse la CI taguée seule publier. |
| [Vercel — GitHub Actions](https://vercel.com/docs/git/vercel-for-github#using-github-actions) | Le flux officiel est `vercel pull`, `vercel build`, puis `vercel deploy --prebuilt` avec les identifiants projet injectés en CI. |
| [Vercel — staged production](https://vercel.com/docs/cli/deploying-from-cli#deploying-a-staged-production-build) | `--prod --skip-domain` crée un candidat production non servi; `vercel promote` l'assigne ensuite aux domaines sans rebuild. |
| [Vercel CLI](https://vercel.com/docs/cli) | `vercel curl` traverse la protection pour le smoke test, et `vercel rollback` réassigne rapidement le déploiement web précédent. |
| [Convex — deploy](https://docs.convex.dev/cli/reference/deploy) | En CI, `CONVEX_DEPLOY_KEY` borne `convex deploy` au déploiement associé sans fichier de secret versionné. |

## Decisions

| Decision | Why |
| --- | --- |
| Release Please pilote un seul produit racine; Changesets et Changelogen ne sont pas ajoutés. | Changesets est utile lorsque plusieurs paquets publient des versions indépendantes. Changelogen observé dans Largo reste plus manuel. Release Please couvre ici directement version, `CHANGELOG.md`, PR, tag et GitHub Release avec moins de code maison. |
| La première release est `v0.1.0`, avec `eb12bc5` comme baseline de bootstrap exclusive et l'historique produit suivant dans le premier changelog. | Le dépôt n'a aucun tag et son `package.json` annonce déjà `0.1.0`; une baseline explicite empêche Release Please d'inventer une version de départ ou de tronquer silencieusement l'historique. |
| Une GitHub App dédiée crée les PR et tags de release; aucun PAT personnel et aucun `GITHUB_TOKEN` pour cette mutation. | Le jeton d'installation est court, attribué à l'automate et limité au dépôt; surtout, ses tags déclenchent réellement le workflow `push.tags`. |
| Seul un tag exact `vMAJOR.MINOR.PATCH`, immuable, rattaché à `main` et égal à la version racine peut entrer en production. | Le glob GitHub `v*` ne valide pas SemVer. Le contrat exécutable et le ruleset ferment les tags ambigus, déplacés ou forgés. |
| Les déploiements Git Vercel sont désactivés; la CI construit une production staged, la vérifie puis la promeut. | Un merge sur `main` ne doit pas contourner la règle « une release = un tag ». La promotion réutilise exactement le build testé et garde les domaines intacts si le candidat échoue. |
| Convex est déployé avant la promotion web et ses changements restent compatibles avec le frontend actuellement servi; le rollback automatique ne concerne que Vercel. | Revenir automatiquement à un ancien schéma Convex après de nouvelles écritures peut casser ou perdre des données. Le backend suit une discipline expand/contract et, en incident, reçoit un correctif avant plutôt qu'un rollback destructif. |
| Les jobs de production sont sérialisés avec la file GitHub `queue: max` et ne sont jamais annulés en cours d'exécution. | Une release plus récente ne doit pas interrompre une mutation Convex ou une promotion Vercel déjà commencée; chaque tag attendu reste traité. |
| GitHub ne reçoit que `VERCEL_TOKEN` et `CONVEX_DEPLOY_KEY`; Resend, Polar et les secrets d'auth restent dans Convex, tandis que Vercel ne porte que les valeurs publiques `VITE_*`. | Le job possède seulement les deux capacités nécessaires au déploiement. Aucun secret serveur n'est téléchargé par `vercel pull` ni exposé au bundle Vite. |
