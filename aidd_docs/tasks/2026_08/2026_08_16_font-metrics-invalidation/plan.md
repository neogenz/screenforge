---
objective: 'Une police qui arrive remesure toute la scène par le seul canal qui possède cet événement, et aucune largeur mesurée sur la police de secours n’atteint le projet.'
status: implemented
---

# Plan: la mesure du texte suit la police, et la largeur déclarée suit le calque

## Overview

| Field      | Value                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Refermer les deux fuites de mesure du chemin polices/canevas : la revalidation posée chez un appelant, et la largeur gonflée par Fabric écrite dans le projet.                                                                                                       |
| **Source** | Débordement de texte constaté à l’ouverture d’un projet importé dans un navigateur neuf (16/08/2026), puis les deux défauts de fond relevés en tirant le fil — le correctif immédiat vit dans `remeasureTextObjects` (`apps/web/src/lib/canvas/canvas-sync.ts`).       |

## Phases

| #   | Phase                                                     | File                         |
| --- | --------------------------------------------------------- | ---------------------------- |
| 1   | L’arrivée d’une police est un événement de scène          | [`phase-1.md`](./phase-1.md) |
| 2   | La largeur déclarée survit à ce que Fabric a mesuré        | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                                     | Why                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fonts.ts` publie « la mesure a changé » ; le canevas s’y abonne.                              | L’invalidation y est déjà centralisée et le commentaire de `loadGoogleFont` le déclare : « c’est ici, et seulement ici, que la mesure change ». Laisser la revalidation dans le `.then()` d’un appelant a produit le défaut du 16/08 — une requête par famille+graisse, donc un seul calque réenroulé pour six écrans.        |
| La largeur déclarée du calque l’emporte sur `dynamicMinWidth`.                                 | `Textbox.initDimensions` remonte `width` à la largeur du plus long mot ; `fabricObjectToLayerUpdate` relit `object.width` et l’écrit dans le projet au premier `object:modified`. Une mesure faite sur la police de secours devenait donc une donnée persistante, différente d’un navigateur à l’autre, qui survit à l’export. |
| Le mot plus large que sa boîte déborde visiblement au lieu d’élargir la boîte.                 | C’est la contrepartie assumée de la décision ci-dessus : la boîte que le panneau annonce est celle que la scène dessine. Le débordement est déjà ce que la revue de locales existe à signaler ; une boîte qui s’élargit toute seule ne l’est pas.                                                                              |
