---
objective: "ScreenForge dispose d’un projet PostHog EU isolé de Pulpe, utile pour l’analytics et le diagnostic, corrélé aux comptes sans capturer de contenu privé ni émettre avant consentement."
status: in-progress
---

# Plan: Brancher PostHog à ScreenForge sous contrôle RGPD

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter analytics, replay, erreurs et logs à ScreenForge, relier les personnes à Convex, Polar et Resend, puis garantir consentement, minimisation, rétention et effacement. |
| **Source** | Demande utilisateur du 2026-08-21 : créer un nouveau projet PostHog ScreenForge, distinct de Pulpe, avec une intégration RGPD et une identité retrouvable entre les services. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Poser le projet EU et la frontière de consentement | [`phase-1.md`](./phase-1.md) |
| 2 | Instrumenter l’usage et l’observabilité utile | [`phase-2.md`](./phase-2.md) |
| 3 | Rendre l’effacement et la rétention durables | [`phase-3.md`](./phase-3.md) |
| 4 | Relier les sources et valider le poste opérateur | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://posthog.com/docs/privacy/gdpr-compliance | PostHog recommande Cloud EU, un consentement explicite pour l’analytics produit identifié et une procédure de droit à l’effacement. |
| https://posthog.com/docs/privacy/data-collection | La capture peut rester désactivée avant consentement et les événements peuvent être filtrés avant envoi. |
| https://posthog.com/docs/product-analytics/identity-resolution | Le chemin recommandé est un identifiant interne stable, attribué tôt et inchangé entre les systèmes. |
| https://posthog.com/docs/session-replay/privacy | Les inputs, textes, éléments et données réseau peuvent être masqués avant de quitter le navigateur. |
| https://posthog.com/docs/session-replay/canvas-recording | Les canvases ne sont pas capturés par défaut et leur masquage DOM ne protège pas leurs pixels s’ils sont activés. |
| https://posthog.com/docs/logs/installation/javascript | Le SDK web fournit des logs structurés, un filtre `beforeSend` et une capture console optionnelle qui doit rester désactivée si la console n’est pas sûre. |
| https://posthog.com/docs/error-tracking/upload-source-maps/vite | Le plugin Rollup officiel peut téléverser les source maps Vite avec une clé personnelle limitée à l’error tracking. |
| https://posthog.com/docs/privacy/data-storage#data-deletion | Les personnes et leurs événements peuvent être supprimés par API avec une clé personnelle, de façon asynchrone. |
| https://posthog.com/docs/data-warehouse/sources/polar | Polar peut synchroniser clients, abonnements, commandes et checkouts dans le data warehouse PostHog. |
| https://posthog.com/docs/data-warehouse/sources/resend | Resend peut synchroniser emails et contacts dans le data warehouse PostHog. |
| https://posthog.com/docs/data-warehouse/sources/convex | Convex peut synchroniser des tables vers PostHog, sous réserve d’un plan Convex Professional et d’une deploy key. |
| https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi | Un traceur non essentiel exige un consentement préalable, libre, éclairé, aussi simple à refuser qu’à accepter et révocable à tout moment. |
| https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience | L’exemption de mesure d’audience exclut le recoupement avec d’autres traitements et les données non anonymes transmises à un tiers. |

## Decisions

| Decision | Why |
| -------- | --- |
| Créer `ScreenForge` dans l’organisation PostHog Cloud EU `neogenz`, sans réutiliser un projet Pulpe. | Les données restent dans la région EU déjà connectée et les droits, événements, coûts et réglages ScreenForge demeurent isolés. |
| Ne charger aucun code PostHog et n’émettre aucune requête avant acceptation locale explicite. | Replay, identification par email et rapprochements externes sortent de l’exemption de simple mesure d’audience ; le mode cookieless ne supprime pas ce besoin. |
| Recueillir séparément `analytics` et `diagnostic`, avec `tout refuser` et `tout accepter` au même niveau. | Les finalités doivent rester spécifiques : replay, erreurs et logs sont plus intrusifs que la seule mesure produit. |
| Utiliser l’ID utilisateur Convex comme `distinct_id`, et l’email comme propriété de personne seulement. | L’ID Convex est stable, Polar le reçoit déjà comme `externalCustomerId`, tandis qu’un email peut changer et ne doit pas devenir une clé. |
| Garder le canvas, les contenus de projet, les corps réseau et la console brute hors capture. | ScreenForge manipule images, textes, noms et secrets locaux ; les diagnostics doivent rester utiles sans envoyer le travail de l’utilisateur. |
| Envoyer uniquement des événements et logs structurés à propriétés autorisées. | La capture console automatique transmettrait les 45 appels `console.*` existants et leurs objets d’erreur sans contrat de confidentialité fiable. |
| Prolonger le job durable de suppression de compte jusqu’à l’effacement PostHog. | Une indisponibilité PostHog ne doit ni conserver silencieusement les données ni empêcher la suppression Convex déjà demandée. |
| Joindre Polar et Convex sur l’ID stable, Resend sur l’email normalisé, sans nouvelle table de correspondance. | Les clés existent déjà dans les trois systèmes ; une quatrième copie pourrait diverger et n’apporterait aucune autorité supplémentaire. |
| Rendre la source Convex optionnelle tant que le plan Professional n’est pas confirmé. | Le connecteur PostHog exige cette offre ; Polar et Resend couvrent déjà le rapprochement commercial et email sans bloquer le socle. |
