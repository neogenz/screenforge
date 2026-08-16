---
objective: "ScreenForge peint immédiatement le bon thème, rend tous ses contrôles composites utilisables au clavier et bloque les dérives visuelles observées sans changer de design system ni ajouter de dépendance."
status: implemented
---

# Plan: durcissement UX/UI et benchmark ciblé

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les défauts UX/UI démontrés en trois lots indépendants tout en conservant l'architecture, le langage visuel et les performances actuels |
| **Source** | Demande utilisateur du 2026-08-12, audit local `audit.md` et cinq références UI fournies |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Premier rendu et focus cohérents en sombre comme en clair | [`phase-1.md`](./phase-1.md) |
| 2 | Contrôles composites réellement utilisables au clavier | [`phase-2.md`](./phase-2.md) |
| 3 | Primitives et garde-fous visuels refermés | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://ui.shadcn.com/docs/components | Le projet utilise déjà le bon contrat ; Radio Group, Tabs, Field et Combobox sont les modèles à reprendre sans restyling global |
| https://ui.shadcn.com/docs/components/combobox | Un combobox composé peut rester local et s'appuyer sur les briques déjà installées |
| https://coss.com/ui/docs/get-started | Coss utilise Tailwind v4 et les variables shadcn mais repose sur Base UI ; une migration complète n'est pas nécessaire |
| https://coss.com/ui/docs/components/autocomplete | Les variantes clear, groupes et popup composé servent de référence fonctionnelle aux pickers recherchables |
| https://appica.dev/ui/components/react/autocomplete | Le modèle couvre liste, groupes, grille 2D, navigation fléchée et popup portallé |
| https://appica.dev/ui/docs/react/installation | Le provider évite le flash du mauvais thème par un script avant peinture ; le même effet tient en quelques lignes natives dans `index.html` |
| https://beautifului.dev/ | Les patterns IA sont pertinents pour Campaign/Assistant, pas pour remplacer le chrome de l'éditeur |
| https://amicro.vercel.app/ | La bibliothèque dépend de Motion ; aucun besoin mesuré ne justifie cette dépendance dans ScreenForge |
| https://www.w3.org/WAI/ARIA/apg/patterns/radio/ | Les groupes radio utilisent un seul point d'entrée Tab puis les flèches déplacent et sélectionnent |
| https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ | Les onglets exigent roving focus, flèches et relation tab/tabpanel |
| https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ | Le champ conserve le focus pendant que les flèches parcourent les suggestions et Entrée accepte la valeur |

## Decisions

| Decision | Why |
| --- | --- |
| Garder Radix/shadcn comme unique fondation UI | Le système actuel passe build, contrastes, responsive et 35 scénarios UX ; Base UI ou Appica doublerait les primitives, tokens et risques de portail |
| Porter les comportements, pas les bibliothèques | Les radios natives, Popover et `cmdk` couvrent les écarts ; les seuls focus roving spécifiques restent locaux à leur widget |
| Ne pas refactorer Fabric ou les gros composants sans mesure | Aucun glitch ou coût anormal n'a été reproduit ; une découpe de fichiers ne réduit pas le travail du navigateur |
| Conserver la structure full-bleed existante | Les captures sombre/clair et les scénarios 320/375 px ne montrent aucun défaut de composition qui justifie une nouvelle navigation |
