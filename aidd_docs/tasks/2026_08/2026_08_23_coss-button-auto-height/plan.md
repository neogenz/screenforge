---
objective: "Un bouton coss à qui l'on demande d'épouser son contenu le fait à toutes les largeurs, et un contrôle dont le contenu déborde de sa boîte fait échouer la suite."
status: in-progress
---

# Plan: Hauteur automatique des boutons coss

## Overview

| Field      | Value                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Rendre leur hauteur aux sept boutons que `sm:h-*` bloque, et poser la garde qui attrapera le prochain                                                                       |
| **Source** | Capture utilisateur du sélecteur de projets : dans « Autres projets », le nom et la pastille « Cet appareil » de chaque ligne se peignent par-dessus les lignes voisines     |

## Phases

| #   | Phase                                       | File                         |
| --- | ------------------------------------------- | ---------------------------- |
| 1   | Décoincer les boutons qui doivent grandir   | [`phase-1.md`](./phase-1.md) |
| 2   | Interdire le retour du défaut, et l'écrire  | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                     | Verified                                                                                                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/ui/button.tsx` (registre `@coss`)  | Chaque variante de taille déclare sa hauteur deux fois : `default` vaut `h-9 … sm:h-8`, `sm` vaut `h-8 … sm:h-7`, `xs` vaut `h-7 … sm:h-6`.               |
| `tailwind-merge`, via le `cn()` de `lib/utils.ts`           | Les groupes de conflit sont indexés par modificateur : un `h-auto` nu annule `h-9`, jamais `sm:h-8`. Aucun `sm:h-auto` n'existe aujourd'hui dans `src/`.  |
| `git show 3030f67^:…/ProjectSwitcher.tsx`                   | Avant coss, la ligne était un `<button>` nu en `min-h-11`, sans hauteur fixe : la régression date de la refonte, la troisième ligne l'a rendue visible.   |

## Decisions

| Decision                                                                          | Why                                                                                                                                                                                     |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corriger aux points d'appel avec `h-auto sm:h-auto`, jamais dans `components/ui/`  | Le seul point de fusion commun serait la primitive coss, que `pnpm run audit:ui` interdit de retoucher puisqu'elle est servie par le registre. Le littéral nomme exactement ce qu'il annule. |
| La garde mesure le débordement rendu, pas la classe écrite                         | Une règle de lint sur `h-auto` ne verrait ni les autres axes (`sm:size-*`, `sm:min-w-*`) ni le jour où coss change ses hauteurs. Le DOM peuplé, lui, ne ment pas.                            |
