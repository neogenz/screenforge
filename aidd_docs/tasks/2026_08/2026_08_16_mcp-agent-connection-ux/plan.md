---
objective: "Le branchement d’un agent devient un parcours compact et immédiatement lisible, où ScreenForge montre chaque jalon réel du MCP et où tous les findings des reviews MCP sont corrigés puis vérifiés par la gate complète."
status: reviewed
---

# Plan: Connexion agents — rendre le MCP aussi clair qu’une tâche locale

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Adapter la clarté de la référence aux connexions MCP et au pont d’assistant, puis refermer sans exception les findings fonctionnels, UX et documentaires de leurs reviews. |
| **Source** | Capture d’écran utilisateur, demandes du 2026-08-16, [`../2026_08_16_mcp-composition-quality/review.md`](../2026_08_16_mcp-composition-quality/review.md) et [`review.md`](./review.md). |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Un cycle MCP vrai jusque dans l’interface | [`phase-1.md`](./phase-1.md) |
| 2   | Une grammaire d’étapes partagée avec le pont d’assistant | [`phase-2.md`](./phase-2.md) |
| 3   | La boîte MCP devient un parcours de connexion clair | [`phase-3.md`](./phase-3.md) |
| 4   | Templates hydratés avant usage et review refermée | [`phase-4.md`](./phase-4.md) |
| 5   | La progression assistant reste honnête après oubli d’une clé | [`phase-5.md`](./phase-5.md) |
| 6   | Une coupure MCP annule atomiquement la sauvegarde d’un gabarit | [`phase-6.md`](./phase-6.md) |
| 7   | La documentation borne exactement les écritures MCP | [`phase-7.md`](./phase-7.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Une progression ne représente que des jalons observables (`démon`, `éditeur`, `prêt`), jamais du temps simulé. | Une barre animée sans mesure rendrait l’opération plus jolie mais moins honnête ; le client observe déjà ces transitions et les publiera explicitement dans son store. |
| Extraire la marche existante de `AssistantSetup` en primitive UI, puis la consommer dans les deux parcours. | Le motif existe déjà et a deux consommateurs immédiats ; le dupliquer dans `McpDialog` créerait deux grammaires de connexion. |
| Garder la boîte MCP au point d’entrée actuel de la TopBar. | Le besoin porte sur la compréhension du branchement, pas sur une nouvelle navigation ni un gestionnaire de flotte. |
| Adapter la référence au monde ScreenForge : neutres achromatiques, citron seulement sur l’étape active, rouge seulement sur l’échec. | Copier son bleu et son fond clair contredirait le chrome dark-first et fausserait le système de marqueur d’état. |
| Le navigateur guide et vérifie ce qu’il peut, mais ne modifie pas la configuration de Claude Code ni celle des services tiers. | Le sandbox navigateur ne peut pas modifier les fichiers du poste ; une automatisation exigerait un nouveau pouvoir local et un modèle de consentement hors de ce besoin. |
| Aucun nouveau package et aucune nouvelle couche de store. | React, Zustand, Tailwind, Lucide, les primitives existantes et le `<details>` natif couvrent le parcours. |
| Les cinq findings de `mcp-composition-quality/review.md` font partie du scope et la gate de release clôt le travail. | Une refonte qui embellirait un cycle encore rouge ou concurrent serait une régression masquée par l’interface. |
