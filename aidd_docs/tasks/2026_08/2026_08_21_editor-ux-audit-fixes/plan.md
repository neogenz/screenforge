---
objective: "L’éditeur ne montre jamais un état faux (succès vert sans lot, nom d’app inventé, compteur codé), sa barre haute hiérarchise ses actions par poids, son écran vide commence par le geste de la cible (ses captures), et ses détails de motion suivent la grille du projet."
status: in-progress
---

# Plan: corrections UX/UI de l’éditeur issues de l’audit du 21/08/2026

## Overview

| Field      | Value                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Corriger les 13 défauts UX/UI et 4 détails de motion constatés sur captures réelles de l’éditeur (1600/1100/800 px, sombre et clair, 12 dialogues), sans nouvelle dépendance ni refonte de structure.                                                                                                                                        |
| **Source** | Demande utilisateur du 21/08/2026 (« analyse UX/UI de la webapp puis de la landing ») ; audit sur captures Playwright + lecture du code, grille `oa-design` et `emil-design-eng` ; constats listés dans la réponse d’analyse de la même session. Le plan jumeau pour la landing est `../2026_08_21_landing-ux-audit-fixes/plan.md`. |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Aucun état faux, aucune copie qui ment             | [`phase-1.md`](./phase-1.md) |
| 2   | Une barre haute qui pèse ses actions               | [`phase-2.md`](./phase-2.md) |
| 3   | Le premier geste est « mes captures »              | [`phase-3.md`](./phase-3.md) |
| 4   | Panneau Propriétés et planche lisibles             | [`phase-4.md`](./phase-4.md) |
| 5   | Motion : pression, clavier, sortie                 | [`phase-5.md`](./phase-5.md) |

## Resources

| Source                                                                  | Verified                                                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/emil-design-eng/SKILL.md` (grille motion)               | Pas d’animation sur une action clavier fréquente ; `scale(0.97)` à la pression ; sortie plus courte que l’entrée ; tooltips voisins sans ré-animation. |
| `.claude/skills/oa-design/_copy.md`                                     | Un bouton dit ce qui arrive ; un état décrit l’état, pas l’événement ; ne jamais affirmer ce que le système n’a pas confirmé.                           |
| https://www.radix-ui.com/primitives/docs/components/tooltip#provider    | `skipDelayDuration` (300 ms par défaut) ouvre les tooltips voisins sans délai ; l’animation d’entrée reste à supprimer côté CSS sur ce chemin.          |
| https://www.radix-ui.com/primitives/docs/components/dialog#content      | `data-state="closed"` est posé pendant la sortie quand le contenu est monté en `forceMount` ou que Radix attend la fin d’une animation CSS.             |

## Decisions

| Decision                                                                                                           | Why                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La barre haute garde des icônes, mais en trois rangs de poids : composer, livrer, utilitaires repliés              | Les libellés sur 9 actions ne tiennent pas sous 1280 px et doubleraient les tooltips existants ; le problème constaté est l’absence de hiérarchie, pas l’absence de mots. Les thresholds de `lib/stage.ts` sont re-dérivés, jamais retouchés à la main. |
| Le geste « mes captures » réutilise le dialogue Générer les visuels (constructeur local, sans IA) au lieu d’un nouvel import | C’est déjà le seul chemin qui transforme N captures en N planches complètes ; un import « capture → cadre » isolé recréerait une mise en page que `lib/ai/archetypes.ts` sait déjà faire. Le dépôt de fichiers ne fait que pré-remplir ce dialogue. |
| La section Transformation n’est pas remontée                                                                        | `CLAUDE.md` a tranché : le type d’abord, la géométrie en socle. On rend le défilement visible au lieu de rediscuter l’ordre.                                                                                                                          |
| La planche en thème clair garde son anneau actuel                                                                   | Choix documenté (« la planche courante est celle qui flotte ») ; le constat est noté, pas corrigé.                                                                                                                                                |
| Aucune dépendance motion (Motion, Base UI)                                                                          | Les quatre corrections tiennent en CSS sur des primitives Radix déjà en place ; même décision que le plan `2026_08_12_ui-ux-polish`.                                                                                                              |
