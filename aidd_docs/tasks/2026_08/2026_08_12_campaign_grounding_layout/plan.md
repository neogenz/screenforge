---
objective: "ScreenForge produit des campagnes App Store ancrées dans le produit, lisibles par défaut et entièrement vérifiables avant insertion."
status: in-progress
---

# Plan: Fiabiliser la génération de campagnes

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Corriger l’ancrage produit, le copywriting, les cadrages et les contrôles de revue, puis valider les correctifs éditeur déjà engagés. |
| **Source** | Demande utilisateur et huit exports Pulpe fournis dans la conversation du 12 août 2026. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Ancrer et contraindre les accroches | [`phase-1.md`](./phase-1.md) |
| 2 | Rendre les compositions lisibles et contrôlables | [`phase-2.md`](./phase-2.md) |
| 3 | Fermer les régressions éditeur et le parcours réel | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://pulpe.app/ | Le produit promet la projection annuelle, l’anticipation des grosses dépenses, les objectifs, la gratuité et l’absence de connexion bancaire. |

## Decisions

| Decision | Why |
| -------- | --- |
| Le modèle reçoit un contexte produit explicite et des descriptions de captures ; l’URL seule reste une provenance. | Le navigateur ne peut pas lire fiablement une page tierce à cause de CORS, et le pont local ne doit pas devenir un proxy d’URL arbitraires exposé aux SSRF. |
| Les compositions éditoriales agressives ne sont plus choisies automatiquement. | Un cadrage impressionnant ne vaut rien si le contenu de l’application devient illisible. |
| Les vrais châssis ScreenForge restent la seule source des appareils, aperçu compris. | La revue doit montrer exactement la structure qui sera posée sur le canvas. |
