---
objective: "Une landing page commerciale bilingue EN/FR, servie par un second entry Vite dans ce repo, présente ScreenForge et ses deux offres (9,99 $/mois, 39,99 $ lifetime) avec un niveau de finition « impeccable »."
status: implemented
---

# Plan: Landing page commerciale ScreenForge

## Overview

| Field      | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Goal**   | Créer la landing commerciale (2e entry Vite, EN/FR, freemium + 2 offres) sans toucher à l'app |
| **Source** | Demande utilisateur (2026-08-05) : landing impeccable, sans AI slop, 9,99 $/mois + 39,99 $ lifetime |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Socle : entry Vite, shell HTML, tokens, i18n EN/FR | [`phase-1.md`](./phase-1.md) |
| 2   | Sections éditoriales : hero, preuve, features      | [`phase-2.md`](./phase-2.md) |
| 3   | Conversion : pricing, FAQ, CTA final, footer, SEO  | [`phase-3.md`](./phase-3.md) |
| 4   | Finition impeccable : motion, visuels réels, audits | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                        | Verified                                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| https://vite.dev/guide/build#multi-page-app                    | MPA via `build.rollupOptions.input` : `landing.html` servi en dev et émis au build        |
| `.impeccable.md` (contexte design projet)                      | Marque : instrument de précision, monochrome chroma 0, Inter variable, dark-first         |
| `aidd_docs/tasks/2026_08/2026_08_05_screenforge-saas/plan.md` | Le checkout Stripe relève du plan SaaS : les CTAs payants de la landing restent provisoires |

## Decisions

| Decision                                                                    | Why                                                                                                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2e entry Vite (`landing.html` + `src/landing/`) dans ce repo               | Réutilise tokens Tailwind v4 et toolchain ; zéro impact sur le bundle de l'app ; déploiement statique unique                                      |
| i18n maison (dictionnaire `copy.ts` EN/FR + toggle), aucune lib             | Une page, deux langues : react-i18next serait du poids mort ; `navigator.language` + localStorage suffisent                                       |
| Inter conservé comme famille unique, différenciation par échelle/graisses   | Cohérence avec les captures produit affichées sur la page ; la règle impeccable « bannir Inter » cède devant la continuité de marque documentée    |
| CTAs payants provisoires (constante `LINKS` unique, mailto/waitlist)        | Le checkout n'existe pas encore (plan SaaS séparé) ; une seule constante à modifier au branchement                                                |
| Visuels = vraies planches exportées par l'app, jamais de mockups génériques | L'anti-AI-slop décisif : la preuve produit est le produit                                                                                         |
