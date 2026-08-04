---
objective: "Les neuf findings de la migration shadcn sont clos et le cadre iPhone ScreenForge adopte un contour plat blanc inspiré d’AppScreens sans régression d’accessibilité, d’interaction ni de release."
status: in-progress
---

# Plan: Corriger la review shadcn et aplatir le cadre iPhone

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Corriger les neuf avertissements de la review puis remplacer le faux châssis 3D par un contour de présentation plat, blanc et légèrement ombré. |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_04_shadcn-migration/review.md`, demande utilisateur du 2026-08-04 et capture `Screenshot 2026-08-04 at 11.48.29.png` |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Fiabiliser les primitives Radix | [`phase-1.md`](./phase-1.md) |
| 2   | Verrouiller les contrats d’interaction | [`phase-2.md`](./phase-2.md) |
| 3   | Aplatir le cadre iPhone | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://appscreens.com/user/project/OEu8a9bFHycubuxc1xZL | Référence visuelle inspectée à 100 % : contour blanc uniforme, coins doux et ombre légère; aucun bouton latéral, reflet métallique ou volume de châssis visible. |

## Decisions

| Decision | Why |
| -------- | --- |
| Le modèle d’iPhone reste la source de la géométrie d’écran, de l’îlot et de l’encoche; sa finition générée devient plate. | Le rendu est simplifié sans perdre les ratios utiles au placement et à l’export de la capture. |
| Les erreurs de toast restent des `alert`; les succès et informations restent des `status`. | Une erreur d’import requiert une annonce immédiate, et le finding autorise explicitement de formaliser ce contrat au lieu de dégrader l’erreur en statut passif. |
| Le chemin « Apple officiel » reste inchangé et ne reçoit ni contour ni ombre générés. | Un bezel Apple importé doit rester pixel-identique à la ressource fournie par Apple. |
