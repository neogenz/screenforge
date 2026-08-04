---
name: audit
description: Audit des dépendances et alignement technologique vs communauté SaaS (août 2026)
argument-hint: N/A
---

# Codebase Audit: dependencies (stack alignment août 2026)

Stack globalement alignée avec les standards communautaires 2026 pour un outil de design local-first ; deux écarts réels : JSZip (projet mort) et un CVE Fabric non patché.

- **Date**: 2026_08_04
- **Scope**: dependencies — `package.json`, `pnpm-lock.yaml`, usages dans `src/`, comparaison web aux pratiques communauté (août 2026)
- **Health**: good
- **Findings**: 0 critical, 6 warning, 5 minor

## Verdict d'alignement (recherche communauté, août 2026)

| Choix du projet | État communauté août 2026 | Verdict |
|---|---|---|
| Fabric.js v7 | v7.4.0, 729k dl/sem, actif, MIT — reste le choix n°1 pour un éditeur de design avec export pixel-exact (`toBlob({multiplier})`). Konva = alternative crédible mais plus bas niveau ; tldraw exige désormais une licence commerciale en production ; PixiJS hors sujet | **Garder** (patch 7.4 + noter la migration future vers `@fabricjs/browser`, le package `fabric` étant devenu une façade) |
| React 19 | 19.2.8 = dernière stable, pas de React 20 à l'horizon | **Garder** |
| Zustand 5 | 5.0.14, toujours le défaut écrasant pour le state client (~8× Jotai) | **Garder** |
| Vite 8 | 8.2.0, Rolldown bundler par défaut — le projet est déjà sur la bonne major | **Garder** (patch 8.2.0) |
| Tailwind v4 CSS-first | 4.3.3, aucune v5, config CSS-first toujours le standard | **Garder** |
| TypeScript 5.9 | TS 7.0.2 (port natif, ~10× plus rapide) sorti le 08/07/2026, mais typescript-eslint 8.66 ne le supporte pas encore (peer `<6.1.0`) — TS 6.0 est la dernière version **officiellement supportée** | **Migrer vers TS 6.0** ; TS 7 seulement quand typescript-eslint v9 officialisera le support |
| ESLint 9 | 10.8.0 dispo ; Biome (2.5.6) n'a pas détrôné ESLint (~14× moins de dl) | **Upgrade 10** |
| Vitest 4 / Playwright | 4.1.10 / 1.62.1 — toujours les standards incontestés | **Garder** |
| pnpm 10 | 11.20.0 = stable, toujours la reco standard | **Upgrade 11** |
| idb 8 | 8.0.3 = dernière, choix par défaut pour du KV/document simple ; Dexie seulement si requêtes indexées/sync ; pas de bascule OPFS | **Garder** |
| JSZip 3.10 | Dernière release août 2022, projet mort (373 issues) ; fflate 0.8.3 le dépasse en téléchargements (54M/sem) et est le remplaçant consensuel | **Basculer → fflate** (`level: 0`, les PNG ne se compressent pas) |
| fast-png 8 | 8.0.0 = dernière, maintenu, rien de nouveau dans le segment | **Garder** |
| lucide-react 1.7 | 1.28.0 — toujours le set d'icônes par défaut React | **Mettre à jour** (vérifier renommages d'icônes) |
| CVA + clsx + tailwind-merge | Toujours le trio standard ; tailwind-merge v3 requis pour TW v4 ; c'est aussi le socle exact de shadcn/ui | **Garder** (sert de base à la migration shadcn) |
| Concept local-first (IndexedDB + canvas + ZIP + Google Fonts) | Validé par le clone open source notable du segment (YUZU-Hub/appscreen, ~2k★, architecture quasi identique) ; le marché concurrentiel part sur du SaaS IA freemium — le positionnement « local, pixel-exact, zéro abonnement » reste différenciant | **Aligné** |

## Décision : migration totale vers shadcn/ui (à planifier)

Décision produit/tech actée le 2026-08-04 : remplacer les primitives UI maison (`src/components/ui/`) par **shadcn/ui** pour avoir une base standard « out of the box » au lieu d'un design system 100 % custom. Migration **totale** : même les composants sans équivalent shadcn (`NumberField` scrub, `SwatchButton`) seront reconstruits par-dessus les primitives Radix.

Points clés pour le plan à venir :
- **Compatibilité native** : shadcn/ui n'est pas une dépendance mais un générateur qui copie les composants dans le repo ; il est construit sur la stack déjà présente (Tailwind v4 CSS-first, CVA, clsx, tailwind-merge, `cn()`, Lucide). Aucun changement de paradigme.
- **Nouvelles dépendances à ajouter** : `radix-ui` (primitives accessibles), `sonner` (toasts, remplace `ToastViewport`), `cmdk` (palette ⌘K, remplace `CommandPalette`), `tw-animate-css` (animations des composants).
- **Ajustements nécessaires** : densité du chrome (shadcn sort en h-9/h-10 par défaut, le projet vise 28-36px → variants de size à définir) ; tokens OKLCH existants dans `@theme` à mapper sur les tokens shadcn ; design language v5 d'`AGENTS.md` à mettre à jour une fois la migration faite.
- **Impact surface** : toutes les features importent depuis `src/components/ui/` — si l'API des composants copiés est adaptée pour rester compatible (mêmes noms/props), la migration se fait fichier par fichier sans toucher aux features.

| Choix du projet | État communauté août 2026 | Verdict |
|---|---|---|
| Primitives UI maison (CVA) | shadcn/ui = standard de fait de l'écosystème React/Tailwind ; socle Radix pour l'a11y | **Migrer vers shadcn/ui** (décision actée, plan à produire) |

## Findings

| Sev | Category     | Location           | Issue                                                                                          | Suggested fix                                                              | Effort |
| --- | ------------ | ------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| 🟡  | dependencies | `package.json:29`  | fabric 7.2.0 < 7.4.0 : CVE modéré GHSA-w22m-hvvm-xmwx (XSS via colorStops dans sérialisation SVG) | `pnpm update fabric` → ^7.4.0                                               | S      |
| 🟡  | dependencies | `pnpm-lock.yaml`   | Vuln high transitive `.>fabric>jsdom>ws` (GHSA-58qx-3vcg-4xpx) — chemin Node/dev uniquement    | Résolue par fabric ≥7.4.0 ; revérifier `pnpm audit`                         | S      |
| 🟡  | dependencies | `package.json:32`  | jszip 3.10.x : projet sans release depuis août 2022, consensus 2026 = fflate                   | Migrer `src/lib/zip.ts` vers fflate `zipSync` (level 0) ; ~-80 kB bundle   | M      |
| 🟡  | dependencies | `package.json:33`  | lucide-react 1.7.0 → 1.28.0 (11 mineures de retard, fixes React 19)                            | `pnpm update lucide-react` + grep des icônes renommées                      | S      |
| 🟡  | dependencies | `package.json:6`   | pnpm 10.26.1 alors que pnpm 11 est la stable de référence                                      | `corepack use pnpm@11`                                                      | S      |
| 🟢  | dependencies | `package.json:46`  | eslint 9.39.4 → 10.8.0 (typescript-eslint 8.66 compatible ^10)                                 | Upgrade ESLint 10                                                           | S      |
| 🟡  | dependencies | `package.json:52`  | typescript 5.9.3 en retard ; TS 6.0 est la dernière version officiellement supportée par typescript-eslint (peer `<6.1.0`) — TS 7.0.2 pas encore supporté | Migrer vers TS 6.0 ; TS 7 attendra typescript-eslint v9                      | M      |
| 🟢  | dependencies | `package.json:29`  | Le package `fabric` est devenu une façade legacy (monorepo `@fabricjs/*`)                       | Planifier migration vers `@fabricjs/browser` (non bloquant)                 | M      |
| 🟢  | dependencies | `package.json:54`  | vite 8.0.3 → 8.2.0 (patch mineur)                                                              | `pnpm update vite @vitejs/plugin-react`                                     | S      |
| 🟢  | dependencies | `package.json:36`  | tailwind-merge 3.5.0 → 3.6.0 (+ patches @types/react, tailwindcss 4.3.3, playwright 1.62.1…)   | `pnpm update` (patches)                                                     | S      |
| 🟢  | dependencies | `package.json`     | Licences : tout MIT/permissif, aucun GPL/AGPL — conforme pour un usage commercial               | RAS                                                                         | S      |
| 🟢  | dependencies | `src/components/ui/` | Primitives UI 100 % maison alors que shadcn/ui est le standard ; décision actée : migration totale (voir section dédiée) | Produire un plan de migration shadcn/ui (radix-ui, sonner, cmdk, tw-animate-css) | L      |

## Top actions

1. **Patch sécurité Fabric** : `pnpm update fabric` (7.4.0) puis `pnpm audit` — résout les 2 vulnérabilités (findings 1-2). Hand-off : refactor.
2. **Remplacer JSZip par fflate** dans `src/lib/zip.ts` (et `src/lib/project-file.ts`, `e2e/helpers.ts`, `scripts/validate-export.mjs`) — seul vrai écart avec le standard 2026 ; bundle et perf en bénéficient (finding 3). Hand-off : refactor.
3. **Migrer TypeScript 5.9 → 6.0** — dernière version officiellement supportée par typescript-eslint ; TS 7 attendra typescript-eslint v9 (finding 6). Hand-off : refactor.
4. **Vague de mises à jour mineures** : lucide-react, vite, eslint 10, pnpm 11, patches divers (findings 4-5, 7, 10, 11). Hand-off : refactor.
5. **Plan de migration shadcn/ui** (décision actée, migration totale — voir section dédiée) : à produire avec aidd-dev-01-plan à la demande. Hand-off : plan puis implement.

## Coverage

- **Scanned**: dependencies (CVEs via `pnpm audit`, outdated via `pnpm outdated`, usage réel vérifié par grep — jszip/fast-png/idb tous utilisés, lockfile présent et intègre, licences vérifiées, alignement communauté via recherche web août 2026)
- **Skipped**: none (périmètre demandé = technologies uniquement ; les 6 autres piliers n'ont pas été demandés)
