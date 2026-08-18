---
objective: "Fermer les neuf findings de sécurité confirmés, prouver le candidat corrigé sur Local et préproduction, et laisser une checklist opérateur complète sans déclencher domaine, fournisseurs production ni release v1."
status: in-progress
---

# Plan: Durcissement sécurité et préparation production

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger toutes les faiblesses actionnables du scan, terminer les preuves préproduction et rendre explicites les seules opérations humaines restant avant la production. |
| **Source** | Demande utilisateur du 2026-08-18, rapport `codex-security:security-scan` courant et plans AIDD Cloud/Preview déjà versionnés. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Stabiliser le socle Polar et la branche courante | [`phase-1.md`](./phase-1.md) |
| 2 | Borner les entrées publiques Auth et Polar | [`phase-2.md`](./phase-2.md) |
| 3 | Valider les médias Cloud et borner les téléchargements | [`phase-3.md`](./phase-3.md) |
| 4 | Sécuriser l’appairage MCP et son coffre d’assets | [`phase-4.md`](./phase-4.md) |
| 5 | Réduire la portée des secrets CI et fermer le preflight production | [`phase-5.md`](./phase-5.md) |
| 6 | Terminer les Previews Vercel et les preuves préproduction | [`phase-6.md`](./phase-6.md) |
| 7 | Asserter, reviewer, rescanner et itérer jusqu’au vert | [`phase-7.md`](./phase-7.md) |
| 8 | Formaliser le handoff et la TODO production | [`phase-8.md`](./phase-8.md) |

## Resources

| Source | Verified |
| --- | --- |
| [GitHub Actions — workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) et [secrets](https://docs.github.com/en/actions/concepts/security/secrets) | Un secret peut être injecté au niveau d’une étape; GitHub recommande le moindre privilège et ne garantit pas que toutes les transformations d’un secret seront masquées. |
| [Convex — request metadata](https://docs.convex.dev/api/modules/server) | `ctx.meta.getRequestMetadata()` fournit l’IP plateforme et la propage aux fonctions imbriquées; une valeur d’en-tête client n’est donc pas nécessaire pour borner Auth et webhook. |
| [Convex — application rate limiting](https://stack.convex.dev/rate-limiting) et [components](https://docs.convex.dev/components/using) | Le composant déjà installé peut borner une action via une mutation transactionnelle, avec une clé par source ou par compte. |
| [Convex — HTTP Actions et limites](https://docs.convex.dev/functions/http-actions) | Les requêtes HTTP sont publiques, les corps/réponses sont bornés à 20 Mio et les accès aux données passent par des fonctions internes. |
| [Convex — fichiers privés](https://docs.convex.dev/file-storage/serve-files) | Une HTTP Action authentifiée est le chemin documenté pour autoriser chaque lecture sans exposer une URL permanente. |
| [Auth.js — source du fournisseur email](https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/index.ts) | L’option email `maxAge` est exprimée en secondes et vaut un jour par défaut; une heure doit donc être configurée explicitement. |
| [Vercel — intégration GitHub](https://vercel.com/docs/git/vercel-for-github) et [configuration Git](https://vercel.com/docs/project-configuration/git-configuration) | L’intégration officielle fournit les Previews de branche; `main` peut rester désactivée pendant que la CI taguée conserve seule l’autorité de production. |
| [Convex — sauvegarde et restauration](https://docs.convex.dev/dashboard/deployments/deployment-settings) | La sauvegarde inclut base et fichiers; une restauration doit être éprouvée dans un déploiement jetable avant la production. |

## Decisions

| Decision | Why |
| --- | --- |
| Dériver les clés anti-abus depuis l’IP fournie par `ctx.meta`, jamais depuis `X-Forwarded-For`, puis les pseudonymiser avec un secret serveur dédié avant le composant de rate limit. | Le client ne peut pas choisir la clé; ni l’IP brute ni une donnée personnelle ne reste dans les logs ou la table du composant. |
| Remplacer le plafond global partagé des liens magiques par deux limites complémentaires, par adresse et par source réseau. | Un balayage ne doit plus pouvoir fermer le lien magique à tous les utilisateurs en changeant seulement d’adresse email. |
| Conserver les lectures et suppressions Cloud après expiration, tout en bornant l’egress par compte authentifié. | La récupération des données reste un droit produit; l’abonnement continue de gouverner uniquement les writes. |
| Valider les octets et dimensions avant stockage, avec une allowlist SVG stricte partagée par le backend et le MCP. | Le type déclaré ne prouve pas le contenu; une seule règle évite que deux frontières de fichiers divergent. |
| Remplacer l’appairage MCP implicite par un code court, éphémère et à usage unique, puis révoquer le jeton et le coffre côté démon. | Une origine absente ou une préférence locale effacée ne doit jamais suffire à obtenir ou conserver la capacité d’écriture locale. |
| Injecter chaque secret CI uniquement dans l’étape qui le consomme et exécuter le preflight Convex avant toute promotion Vercel. | L’installation et le build ne reçoivent plus les deux autorités de déploiement; une configuration serveur incohérente bloque la promotion. |
| Réutiliser les plans `2026_08_16_vercel-pr-previews` et `2026_08_16_cloud-prelaunch-validation` comme sous-plans, sans recopier leur procédure fournisseur. | Ils portent déjà les frontières Preview, Sandbox, sauvegarde et browser QA; une seconde procédure dériverait. |
| Le présent plan peut être clôturé quand les corrections et preuves préproduction sont vertes et que `production-todo.md` est complet; l’exécution de cette TODO reste derrière `GO DOMAIN` et `GO PRODUCTION`. | Le durcissement ne doit ni acheter un domaine ni créer un paiement réel ou un tag avant la décision utilisateur. |
