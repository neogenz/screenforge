---
objective: "La landing passe au prerender (HTML complet servi, deux documents EN/FR avec hreflang) et adopte une direction specimen/blueprint qui lui donne un caractère propre, avec une copy honnête vis-à-vis du SaaS à venir."
status: in-progress
---

# Plan: Landing v2 — prerender SEO + direction specimen/blueprint

## Overview

| Field      | Value                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------- |
| **Goal**   | Corriger les trois défauts de la v1 : CSR mauvais pour SEO/LCP, design lambda, copy local-first fausse |
| **Source** | Retour utilisateur (2026-08-05) sur la v1 implémentée (`2026_08_05_landing-page-commerciale`)       |

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Prerender au build : HTML complet, documents EN + FR, hreflang | [`phase-1.md`](./phase-1.md) |
| 2   | Copy v2 : piliers honnêtes (pixel-exact, vitesse, lifetime)  | [`phase-2.md`](./phase-2.md) |
| 3   | Design v2 specimen/blueprint : caractère, callouts, pricing-tableau | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                          | Verified                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| https://vite.dev/guide/ssr                                      | `vite build --ssr` produit le bundle de rendu ; le script de prerender injecte dans le HTML |
| `aidd_docs/tasks/2026_08/2026_08_05_screenforge-saas/plan.md`  | Le produit devient un SaaS : toute promesse « sans compte jamais » est fausse d'ici là     |

## Decisions

| Decision                                                              | Why                                                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Prerender via `react-dom/server` au build, hydratation légère         | Garde la stack React/Tailwind ; HTML complet pour SEO et LCP ; Astro se justifiera seulement si un blog arrive              |
| Deux documents statiques (`landing.html` EN, `landing-fr.html` FR)    | hreflang réel, titre/description par langue dans le HTML servi ; le toggle navigue entre documents au lieu de muter le DOM  |
| Direction specimen/blueprint                                          | La v1 appliquait le chrome de l'outil (qui doit s'effacer) à une vitrine (qui doit affirmer) ; le plan technique est la voix de la marque, sans couleur ajoutée |
| Pricing en tableau comparatif hairline, pas trois cartes              | La grille de cartes identiques est le marqueur SaaS générique n°1 ; le tableau de spécification porte la direction blueprint |
| Piliers copy : pixel-exact, rendu local (vrai même en SaaS), lifetime | « Sans compte / sans upload » deviendra faux avec la sync cloud ; le rendu Fabric reste local même connecté — promesse durable |
