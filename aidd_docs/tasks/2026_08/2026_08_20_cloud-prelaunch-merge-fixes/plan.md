---
objective: "Rendre la PR #12 réellement mergeable en garantissant le consentement Cloud, des origines d’authentification exactes, une documentation publique expurgée et des gates de release verts sur un même SHA."
status: in-progress
---

# Plan: fermer les blockers de la PR Cloud avant merge

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les deux régressions de sécurité et de confidentialité, remettre CSP et Quality au vert, puis produire une preuve de merge sur le HEAD exact de la PR. |
| **Source** | Demande utilisateur du 2026-08-20, review de `codex/cloud-prelaunch-plan` (`f4fe3b9..a846383`) et rapport Codex Security `35294961-be4f-496e-ad18-f9c323c8ba89`. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Rendre le refus Cloud durable | [`phase-1.md`](./phase-1.md) |
| 2 | Remplacer les suffixes Preview par des origines exactes | [`phase-2.md`](./phase-2.md) |
| 3 | Expurger la documentation et stabiliser les gates | [`phase-3.md`](./phase-3.md) |
| 4 | Prouver le candidat final sur un SHA unique | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| --- | --- |
| [Vercel — Generated URLs](https://vercel.com/docs/deployments/generated-urls) | Les URLs générées incluent un `scope-slug` de compte ou d’équipe; une égalité textuelle de suffixe ne prouve donc pas la propriété de l’origine. |
| [Playwright — Continuous Integration](https://playwright.dev/docs/ci) | L’installation `playwright install --with-deps` est le chemin officiel sur GitHub Actions et l’exemple officiel réserve 60 minutes au job navigateur. |
| [GitHub Actions — Quality #79](https://github.com/neogenz/screenforge/actions/runs/32217604867) | Le job E2E a été annulé au timeout de 20 minutes pendant l’installation système Playwright, avant l’exécution des tests. |

## Decisions

| Decision | Why |
| --- | --- |
| Un projet préexistant reste bloqué par une barrière de consentement par compte et projet; un commit local ne crée jamais cette autorisation. | Sauvegarder prouve seulement la durabilité locale, pas l’accord de transférer les données au Cloud. |
| Les projets créés après l’activation Cloud continuent à s’enrôler automatiquement, tandis qu’un changement de compte reconstruit la barrière avant toute file d’upload. | Le correctif doit préserver le comportement annoncé sans rattacher les projets historiques au mauvais compte. |
| Auth et CORS n’acceptent que des origines exactes; les Previews Vercel éphémères ne portent pas de parcours Cloud authentifié partagé. | Un suffixe `.vercel.app` est une forme de nom, pas une preuve de contrôle; l’auth hébergée se valide sur une origine de préproduction stable. |
| `CLOUD.md` décrit l’architecture et les procédures, jamais les volumes, sessions, comptes ou états fournisseur réels. | Le dépôt public n’est pas un inventaire opérationnel; les valeurs courantes restent hors Git. |
| Le CSP reste strict et reçoit uniquement les hashes exacts du build; aucun `unsafe-inline` ni assouplissement n’est ajouté. | Le gate détecte correctement un manifeste de hashes périmé et ne doit pas être contourné pour redevenir vert. |
| Le job E2E conserve l’installation Playwright officielle et passe à 60 minutes, sans retry, cache système ou conteneur supplémentaire. | Le timeout actuel est inférieur au budget officiel et a expiré sur APT; une nouvelle infrastructure serait spéculative. |
