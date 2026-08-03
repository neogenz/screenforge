---
objective: "Les calques locaux peuvent être transférés par glisser-déposer entre écrans et être coupés, copiés puis collés au clavier sur macOS et Windows."
status: in-progress
---

# Plan: Transfert de calques entre écrans et presse-papiers clavier

## Overview

| Field      | Value                                      |
| ---------- | ------------------------------------------ |
| **Goal**   | Rendre le drag inter-écrans et C/X/V fiables |
| **Source** | Demande textuelle utilisateur du 2026-08-03 |

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Transfert inter-écrans par glisser-déposer | [`phase-1.md`](./phase-1.md) |
| 2   | Couper, copier et coller au clavier        | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Un calque local change d’écran lorsque le centre de la sélection est relâché dans une autre planche ; un dépôt dans une gouttière ou hors planche conserve l’écran source. | Cette règle est déterministe pour les objets tournés ou débordants et évite un transfert accidentel pendant la traversée. |
| Les calques partagés conservent leur portée `layout` pendant un drag ou un collage. | Leur position appartient déjà à l’espace continu du projet ; les convertir en calques locaux casserait leur sémantique. |
| Un dépôt qui change d’écran actif ne recadre pas la vue. | L’abonnement au changement d’écran actif rezoome le stage sur la planche visée, ce qui est juste pour un clic dans la pellicule mais téléporterait la vue sous la main de l’utilisateur en fin de geste. |
| L’aide des raccourcis garde ses glyphes ⌘. | La double notation sur une seule ligne se lirait comme un défaut ; passer l’aide entière à la plateforme courante est une décision distincte. |
