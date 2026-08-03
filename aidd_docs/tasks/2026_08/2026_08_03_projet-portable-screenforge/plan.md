---
objective: "ScreenForge peut télécharger un projet complet dans une archive portable puis l’ouvrir dans un autre navigateur sans perdre ses écrans, réglages ou assets."
status: pending
---

# Plan: Projet ScreenForge portable

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter une sauvegarde fichier indépendante d’IndexedDB, réimportable localement avec tous les assets du projet |
| **Source** | Annotation utilisateur du 2026-08-03 demandant un export/import `.screenforge.zip` contenant le projet JSON et ses assets |

La sauvegarde IndexedDB et son autosave restent le chemin courant. Le fichier portable est une
copie volontaire destinée au backup, au transfert vers un autre navigateur ou à la reprise sur
une autre machine. Il ne contient aucun asset global ou inutilisé et ne déclenche aucun réseau.

## Phases

| #   | Phase                                      | File                         |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Contrat d’archive versionné et sûr         | [`phase-1.md`](./phase-1.md) |
| 2   | Menu Projet et round-trip navigateur       | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Une archive ZIP versionnée, nommée `<projet>.screenforge.zip`, contient un manifeste JSON et les assets binaires séparés | Le graphe reste lisible et compact, les images ne sont pas dupliquées en data URLs dans le JSON, et JSZip est déjà installé |
| L’import est entièrement validé avant toute mutation du store ou du registre d’assets | Un fichier incomplet, corrompu ou d’une version inconnue ne doit jamais remplacer le travail ouvert |
| Un projet importé reçoit un nouvel identifiant de projet et de nouveaux identifiants d’assets | Importer une sauvegarde crée une copie indépendante et ne peut pas écraser un projet ou un asset IndexedDB existant |
| Les miniatures d’écran sont exclues de l’archive et régénérées par le canvas | Elles sont dérivées du projet, volumineuses et ne sont pas nécessaires pour restaurer le contenu |
| Aucun nouveau package ni backend | Les APIs navigateur, Web Crypto et JSZip couvrent le téléchargement, l’intégrité et l’extraction en local |
