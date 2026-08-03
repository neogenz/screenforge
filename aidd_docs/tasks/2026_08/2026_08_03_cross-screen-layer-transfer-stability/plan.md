---
objective: "Le transfert inter-écrans conserve son comportement tout en isolant son calcul métier et en verrouillant les enchaînements répétés et les sélections mixtes par E2E."
status: implemented
---

# Plan: Stabiliser le transfert inter-écrans

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Réduire le risque de régression du transfert sans nouvelle infrastructure |
| **Source** | Demande textuelle utilisateur du 2026-08-03 |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Isoler et verrouiller le transfert | [`phase-1.md`](./phase-1.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Le calcul du prochain état projet devient une fonction pure hors du gestionnaire Fabric, tandis que la détection géométrique, l’historique et la sélection restent dans `use-canvas`. | Le calcul sérialisable est testable et lisible sans déplacer les responsabilités propres à Fabric. |
| Les nouvelles protections restent dans la suite Playwright existante. | Ajouter un second moteur de tests pour une seule extraction augmenterait la maintenance sans mieux couvrir le cycle canvas → store → synchronisation. |
