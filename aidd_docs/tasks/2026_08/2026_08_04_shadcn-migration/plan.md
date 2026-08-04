---
objective: "Toutes les primitives de src/components/ui/ sont basées sur shadcn/ui (Radix + Tailwind v4 + CVA), avec densité 28-36px, tokens OKLCH et contrats aria/e2e existants préservés."
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Migration totale vers shadcn/ui

## Overview

| Field      | Value                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------- |
| **Goal**   | Remplacer les 21 primitives UI maison par des composants shadcn/ui, sans toucher aux features       |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_04_audit/dependencies.md` (section « Décision : migration shadcn ») |

## Phases

| #   | Phase                                  | File                         |
| --- | -------------------------------------- | ---------------------------- |
| 1   | Fondations shadcn + composants simples | [`phase-1.md`](./phase-1.md) |
| 2   | Contrôles de formulaire                | [`phase-2.md`](./phase-2.md) |
| 3   | Overlays, menus et dialogs             | [`phase-3.md`](./phase-3.md) |
| 4   | Toast, palette ⌘K et spécifiques       | [`phase-4.md`](./phase-4.md) |

## Resources

<!-- External sources only (URLs, docs), not code files. Omit if none consulted. -->

| Source                                                    | Verified                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| https://ui.shadcn.com/docs/installation/vite              | Setup Vite + Tailwind v4 CSS-first confirmé compatible (projet déjà conforme : pas de config JS)   |
| https://ui.shadcn.com/docs/components-json                | `components.json` requis ; `baseColor: "neutral"` = OKLCH achromatique, aligné « true neutral » v5 |
| Context7 `/shadcn-ui/ui` (globals.css v4)                 | Tokens shadcn mappables sur les CSS vars OKLCH existantes via `@theme inline`                      |

## Decisions

<!-- Architecture-magnitude only, one you'd regret reversing. Omit if none qualify. -->

| Decision                                                                                     | Why                                                                                                                          |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Wrappers de compatibilité : garder les noms/props actuels (`Button`, `Dialog`…) par-dessus les composants shadcn | Les features importent depuis `@/components/ui/*` partout (11 fichiers pour Button) ; préserver l'API évite de réécrire les features |
| Tokens custom conservés : rayons 4/6/9/14/18, z-index nommés, utilitaires `accent-fill/mark`, classes `.field-surface`… | Le design language v5 (AGENTS.md) prime ; shadcn est re-thémé dessus, pas l'inverse                                            |
| Exceptions assumées à la « migration totale » : `NumberField` (scrub), `SwatchButton`, `Kbd` restent custom mais re-stylés aux tokens shadcn | Aucun équivalent Radix/shadcn amont ; le scrub du NumberField est un contrat produit couvert par les e2e transforms              |
| `Tooltip` supprimé (0 import) plutôt que migré                                                | Code mort confirmé par l'inventaire                                                                                           |
