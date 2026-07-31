---
objective: "ScreenForge arbore une UI v3 monochrome ultra-sobre (classe Linear/Vercel) : une seule barre fine en haut, panneaux rétractables, stage maximal, typographie Geist unique, rouge réservé à l'export."
status: in-progress
---

# Plan: Refonte totale UI v3 — monochrome premium, réduction maximale

## Overview

| Field      | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Goal**   | Refondre toute l'UI (tokens, primitives, shell, panneaux) vers un chrome minimal classe Linear |
| **Source** | Demande utilisateur du 2026-07-30 : « ui bien plus simple et premium », refs Linear/Vercel/Railway |

Choix confirmés avec l'utilisateur : palette **monochrome ultra-sobre** (graphite chaud quasi neutre, accent blanc, rouge uniquement pour l'export), structure **réduction maximale** (barre unique fine, drawers latéraux rétractables, stage maximal), typographie **sans unique + caps discrètes** (Geist, abandon du mono décoratif).

## Phases

| #   | Phase                    | File                         |
| --- | ------------------------ | ---------------------------- |
| 1   | Fondations (tokens + CSS) | [`phase-1.md`](./phase-1.md) |
| 2   | Primitives UI            | [`phase-2.md`](./phase-2.md) |
| 3   | Shell (barre + drawers)  | [`phase-3.md`](./phase-3.md) |
| 4   | Panneaux & éditeurs      | [`phase-4.md`](./phase-4.md) |
| 5   | Nettoyage & vérification | [`phase-5.md`](./phase-5.md) |

## Resources

| Source                                    | Verified                                                        |
| ----------------------------------------- | --------------------------------------------------------------- |
| `.impeccable.md` (design context v2)      | Base à faire évoluer en v3 (personnalité inchangée, direction remplacée) |
| `src/index.css` (inventaire exploration)  | Tokens actuels, 12 classes globales, fuites hex identifiées     |
| Inventaire `src/components/` (exploration) | 18 primitives + 30 composants feature cartographiés, hardcodes listés |

## Decisions

| Decision                                                        | Why                                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Geist Sans (+ Geist Mono pour valeurs tabulaires) remplace Archivo + Chivo Mono | Référence Vercel assumée, une seule famille = hiérarchie par poids/taille, fin du mono décoratif |
| Rouge `#d71921` réduit à un seul usage : le bouton Exporter      | Un accent rare garde son pouvoir ; l'actif/selection passe au neutre (bordure claire)        |
| Focus ring neutre clair, suppression du bleu `--color-accent`   | Cohérence monochrome ; le bleu cassait la discipline de palette                              |
| Drawers latéraux superposés au stage (pas de rails fixes)       | Stage maximal par défaut ; les panneaux n'occupent l'espace qu'à la demande                  |
| Constantes de layout unifiées dans `lib/stage.ts` (insets, z)   | Aujourd'hui dupliquées entre `App.tsx` et `stage.ts`, source de désynchro                    |
