---
objective: "L’arrivée asynchrone d’une police remesure les textes sans déplacer leur position sauvegardée, y compris pour les calques de layout."
status: implemented
---

# Plan: préserver la position des textes après remesure

## Overview

| Field      | Value                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| **Goal**   | Garder le même coin supérieur gauche lorsqu’une nouvelle métrique change la hauteur d’un texte.   |
| **Source** | Description utilisateur du 21/08/2026 et diagnostic confirmé dans la tâche Codex correspondante. |

## Phases

| #   | Phase                                        | File                         |
| --- | -------------------------------------------- | ---------------------------- |
| 1   | La remesure conserve l’ancrage du calque     | [`phase-1.md`](./phase-1.md) |
