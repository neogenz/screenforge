---
objective: "Un visiteur comprend en un écran ce que ScreenForge fait, dans quelle langue est l’éditeur et quelle offre lui est destinée ; la navigation est visible dès qu’elle tient, les sections montrent leur contenu sans clic, la démo ne commence jamais par du vide, et le pied de page dit comment joindre l’auteur."
status: implemented
---

# Plan: corrections UX/UI de la landing issues de l’audit du 21/08/2026

## Overview

| Field      | Value                                                                                                                                                                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Corriger les 10 défauts constatés sur la landing EN et FR (1440 px et 390 px, page entière, démo suivie 30 s) : parcours, hiérarchie des CTA, sections cachées, démo, pied de page. Aucun changement d’identité visuelle (Gloock, Plex Mono, citron).                                                    |
| **Source** | Demande utilisateur du 21/08/2026 ; audit sur captures Playwright + lecture de `apps/web/src/landing/` ; grille `oa-design/_landing.md` et `_copy.md`. Reprend une décision non appliquée du plan `2026_08_13_landing-quality` (ancres de nav inline dès que la barre a la place). Plan jumeau : `../2026_08_21_editor-ux-audit-fixes/plan.md`. |

## Phases

| #   | Phase                                                  | File                         |
| --- | ------------------------------------------------------ | ---------------------------- |
| 1   | Le premier écran dit tout ce qu’il faut, une fois      | [`phase-1.md`](./phase-1.md) |
| 2   | Les sections montrent, elles ne font pas cliquer       | [`phase-2.md`](./phase-2.md) |
| 3   | La démo ne commence jamais par du vide                 | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                        | Verified                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `.claude/skills/oa-design/_landing.md`                        | Hero : le résultat en une phrase, deux CTA au plus ; couper des sections plutôt que les rétrécir ; pas de section cachée derrière un clic.  |
| `.claude/skills/oa-design/_copy.md`                           | Ne jamais promettre ce que le système ne confirme pas ; un bouton dit ce qui arrive.                                                        |
| `aidd_docs/tasks/2026_08/2026_08_13_landing-quality/plan.md`  | Décision déjà prise : ancres inline dès que la barre a la place ; `Nav.tsx:128` l’applique au seul CTA. Ce plan l’étend aux ancres.         |
| MDN IntersectionObserver (`rootMargin`)                       | Le seuil se mesure contre le viewport ; un `rootMargin` négatif en haut compense la barre fixe de 72 px.                                    |

## Decisions

| Decision                                                                                                   | Why                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le citron reste la couleur des CTA de la landing                                                           | La landing est une surface à part, sombre, avec sa propre grammaire ; y importer le « marker = état » de l’éditeur retirerait son seul point chaud. La tension est documentée ici, pas corrigée. À rouvrir si un test utilisateur montre une confusion. |
| Local est le CTA primaire du pricing, Cloud le secondaire                                                  | Principe produit n°1 (« Local est complet ») et objectif de la page (faire ouvrir l’éditeur). Cloud se vend depuis l’éditeur, où la session et le checkout vivent.                                                                                     |
| La mention « éditeur en français » se place sous le CTA hero, version EN seulement                          | C’est la seule information qui change ce que le visiteur EN va vivre au clic ; la FAQ la garde aussi. La version FR n’a rien à dire.                                                                                                                   |
| Pas de page légale inventée ; le pied de page gagne un lien de contact vers les issues GitHub               | « La preuve précède la promesse » : aucun texte légal n’existe dans le dépôt et un agent ne doit pas l’écrire. Le texte des mentions / confidentialité est à fournir par l’utilisateur ; ce plan pose seulement l’emplacement.                        |
| Les onglets Composer / Actualiser / Exporter deviennent trois blocs empilés, sans tablist                  | Deux tiers du contenu étaient derrière un clic. Trois blocs lisibles valent plus qu’un composant ARIA correct mais fermé.                                                                                                                              |
