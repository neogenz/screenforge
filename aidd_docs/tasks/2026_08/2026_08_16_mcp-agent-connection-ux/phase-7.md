---
status: done
---

# Instruction: La documentation borne exactement les écritures MCP

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── apps/mcp/README.md  ✏️ distinguer projet, bibliothèque de gabarits et écriture arbitraire
```

## User Journey

```mermaid
flowchart TD
  A["L’utilisateur lit la portée du serveur MCP"] --> B["Il distingue les mutations du projet et la bibliothèque de gabarits"]
  B --> C["Il comprend qu’aucune écriture arbitraire de fichier n’est exposée"]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Ouvrir la documentation MCP => section de portée visible: 5: system
  section Happy path
    Lire la portée puis le tableau des outils => affirmations cohérentes sur projet et gabarits: 5: system
```

## Tasks to do

### `1)` Nommer les seules destinations d’écriture

> La documentation de sécurité ne doit pas se contredire trois lignes plus bas.

1. Remplacer l’interdiction générale par l’absence d’écriture arbitraire.
2. Nommer le projet ouvert et la bibliothèque locale de gabarits.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le README ne prétend plus que toute écriture hors projet est impossible. |
| 1 | Le README limite explicitement les écritures au projet ouvert et à la bibliothèque locale de gabarits, sans accès arbitraire au système de fichiers. |
