---
objective: "Le design system ne surcharge plus shadcn que par 13 tokens produit, et les échelles rendues (type, hauteurs, rythme, rayons) sont fermées et vérifiables."
status: in-progress
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Aligner le design system sur le contrat shadcn et fermer les échelles

## Overview

| Field      | Value                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Réduire la surcharge shadcn à ce que le produit ajoute vraiment, et remplacer les échelles ouvertes par des échelles fermées     |
| **Source** | Audit `/impeccable audit` du 2026_08_04 (13/20, verdict Implementation Integrity = échec) + demande utilisateur « ne pas surcharger shadcn » |

## Phases

| #   | Phase                                | File                         |
| --- | ------------------------------------ | ---------------------------- |
| 1   | Contrat de tokens shadcn             | [`phase-1.md`](./phase-1.md) |
| 2   | Échelles métriques fermées           | [`phase-2.md`](./phase-2.md) |
| 3   | Rythme vertical et géométrie d'îlot  | [`phase-3.md`](./phase-3.md) |
| 4   | Correctifs a11y et responsive        | [`phase-4.md`](./phase-4.md) |

## Resources

<!-- External sources only (URLs, docs), not code files. Omit if none consulted. -->

| Source                                                                                          | Verified                                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github.com/shadcn-ui/ui` → `apps/v4/registry/themes.ts`                                        | Les thèmes officiels sont `neutral, stone, zinc, gray, slate`. Aucun thème « Vercel ». `neutral` pose `radius: 0.625rem` et une rampe chroma 0.       |
| `github.com/shadcn-ui/ui` → `apps/v4/registry/new-york-v4/ui/button.tsx`                        | Tailles boutons amont : `h-6 / h-8 / h-9 / h-10`, plus `size-6/8/9/10` pour les icônes. Aucune hauteur impaire. Base : `rounded-md text-sm`.          |
| `ui.shadcn.com/docs/theming`                                                                    | Un thème ne porte que couleurs, `--radius`, polices, ombres. La chaîne de rayons est dérivée de `--radius` par `calc()`.                              |
| `tweakcn.com/r/themes/vercel.json`                                                              | Le preset « Vercel » est tiers : `radius 0.5rem`, Geist, `background oklch(0 0 0)` en dark, ombres 1–8px. Confirme qu'il ne porte aucune échelle de type ou de densité. |

## Decisions

<!-- Architecture-magnitude only, one you'd regret reversing. Omit if none qualify. -->

| Decision                                                                                                                    | Why                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inverser la décision de `2026_08_04_shadcn-migration` : les noms shadcn deviennent le vocabulaire primaire, le design language v5 se mappe dessus | L'ancienne décision (« shadcn est re-thémé dessus, pas l'inverse ») a produit deux vocabulaires concurrents, 7 usages du pont contre 190+ tokens natifs, et un pont `@theme inline` mort. L'utilisateur demande explicitement l'inverse. |
| Renommer l'accent citron `--color-accent` → `--color-marker`                                                                 | `accent` est réservé chez shadcn à la surface de survol neutre (`hover:bg-accent`). Le garder en citron piège tout composant shadcn stock ajouté plus tard.                                        |
| Ne conserver que 13 tokens hors contrat shadcn (`stage`, `success`, `warning`, `artboard-*`, `shadow-inset`, `hairline-top`, 6 `z-*`) | Ce sont les seuls concepts que shadcn n'a pas et que le produit exige : fond de scène, sémantique d'état non destructive, chrome d'artboard, empilement nommé.                                     |
| Garder `--color-stage` à `oklch(0.145 0 0)` plutôt que le noir pur du preset Vercel                                          | Un entourage noir pur maximise le contraste simultané autour d'un artboard clair et fausse le jugement couleur de l'utilisateur, qui est la tâche centrale du produit.                             |
| Fermer les échelles par une garde exécutable (`scripts/scale-audit.mjs`) et non par convention documentée                    | La règle « rayon intérieur = extérieur − marge » est écrite dans `index.css` depuis v5 et violée sur les 5 îlots. Une règle non vérifiée dérive.                                                    |
