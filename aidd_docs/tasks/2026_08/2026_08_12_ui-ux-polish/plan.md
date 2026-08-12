---
objective: "ScreenForge ne promet aucun modèle clavier qu'il ne tient pas, garde un seul langage de focus et de sélection dans les deux thèmes, résiste aux fragilités mesurées du canvas et de l'historique, et gagne des micro-interactions soignées sans nouvelle dépendance."
status: pending
---

# Plan: polish UX/UI post-durcissement et micro-interactions

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les bugs et fragilités prouvés par l'audit du 2026-08-12 (trois axes : thème/primitives, perf/canvas, a11y/parcours), unifier le contrat focus/sélection en sombre comme en clair, puis porter des micro-interactions inspirées d'Amicro en CSS natif |
| **Source** | Demande utilisateur du 2026-08-12, audit trois agents post-commits fa08920/9b18754/6a8e4b0/6d441cc, cinq références UI fournies |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Bugs démontrés P1 | [`phase-1.md`](./phase-1.md) |
| 2 | Un contrat focus, sélection et thème unique | [`phase-2.md`](./phase-2.md) |
| 3 | Modèles clavier conformes aux rôles annoncés | [`phase-3.md`](./phase-3.md) |
| 4 | Robustesse canvas, historique et stores | [`phase-4.md`](./phase-4.md) |
| 5 | Micro-interactions à la Amicro, en CSS natif | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://amicro.vercel.app/ | Catalogue de micro-transitions React+Motion ; les patterns (settle de sélection, entrée/sortie de liste, morph d'action) se portent en CSS sans dépendance Motion |
| https://ui.shadcn.com/docs/components | Contrat déjà adopté ; Radio Group, Tabs, Combobox et Field restent les modèles de comportement |
| https://coss.com/ui | Base UI + Tailwind v4 ; leurs Toolbar et Number Field valident les choix actuels, aucune migration |
| https://appica.dev/ui/components/react/autocomplete | Confirme le piège portals/thème scopé et le besoin de `color-scheme` ; l'autocomplete grid est déjà atteint par FontPicker |
| https://beautifului.dev/ | Patterns IA (thinking, approval) utiles seulement si Campaign/Assistant devient un chat ; hors périmètre chrome |
| https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ | Listbox : focus roving, flèches, sélection qui suit ou non le focus |
| https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ | Toolbar : un seul Tab stop, flèches entre contrôles — sinon rétrograder en `group` |
| https://www.w3.org/WAI/ARIA/apg/patterns/slider/ | Slider : Home/End attendus en plus des flèches |

## Decisions

| Decision | Why |
| --- | --- |
| Aucune migration vers Base UI, Appica ou Motion | Le socle Radix/shadcn + tokens OKLCH passe tous les audits ; un second socle doublerait primitives, tokens et risques de portail pour zéro défaut corrigé |
| Micro-interactions en CSS/WAAPI natif uniquement | Amicro dépend de Motion ; le budget main-thread est déjà monopolisé par Fabric.js et `prefers-reduced-motion` est un standard du projet — des easings spring-like (`linear()`, cubic-bezier) couvrent les cas retenus |
| Re-vérifier chaque référence fichier:ligne au démarrage de chaque phase | Un agent de refactor travaille en parallèle sur le code ; les numéros de ligne de l'audit peuvent dériver, les constats restent valides mais doivent être re-localisés avant chaque tâche |
| Ne pas scinder les gros composants (TopBar, CampaignDialog) | Aucun profil ni défaut ne le justifie ; la phase 4 corrige des fragilités ciblées sans découpe spéculative |
