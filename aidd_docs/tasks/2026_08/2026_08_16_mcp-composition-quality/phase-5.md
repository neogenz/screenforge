---
status: pending
---

# Instruction: Le serveur rend ce que la spec 2026-07-28 sait lire

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── apps/mcp/src/tools/
│   ├── editor-tools.ts                   ✏️ `title` partout, `outputSchema` + `structuredContent` là où la forme est déclarée
│   ├── templates.ts                      ✏️ rend sa forme structurée en plus de son texte
│   └── get-thumbnail.ts                  ✏️ les constats de la phase 2 deviennent lisibles par la machine
└── apps/mcp/src/
    └── relay.test.ts                     ✏️ un outil sans titre est un échec, comme un exemple qui dérive
```

## User Journey

```mermaid
flowchart TD
  A[Un client MCP liste les outils] --> B[Il affiche « Rafraîchir les captures », pas screenforge_refresh_screenshots]
  B --> C[L'agent appelle un outil qui rend du JSON]
  C --> D{Une forme est-elle déclarée ?}
  D -- oui --> E[structuredContent, relu sans réanalyser du texte]
  D -- non --> F[Le bloc texte seul, comme aujourd'hui]
  E --> G[Le bloc texte reste, pour les clients qui ne lisent que lui]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Enregistrer les outils sur un serveur de test => catalogue en mémoire: 5: system
  section Happy path
    Lire le catalogue => chaque outil porte un titre lisible: 5: system
    Appeler un outil à forme déclarée => structuredContent conforme à son outputSchema: 5: system
  section Edge case - forme non déclarée
    Appeler get_project_state => bloc texte seul, aucun structuredContent orphelin: 1: system
  section Edge case - refus
    Provoquer un refus => isError, et aucun structuredContent qui prétendrait un succès: 1: system
  section Edge case - le démon démarre encore
    Lancer node sur main.ts => le pont écoute: 1: cli
```

## Tasks to do

### `1)` Chaque outil porte un titre

> Le nom technique est une adresse, pas une étiquette.

1. Donner un `title` à chaque `registerTool` : ce que l'outil fait, dans les mots de l'utilisateur, jamais le nom préfixé.
2. Le préfixe `screenforge_` reste sur le nom — c'est ce qui distingue `add_text` de l'outil homonyme d'un autre serveur.

### `2)` La sortie structurée, là où la forme est déjà écrite

> Une forme déclarée deux fois est une forme qui divergera.

1. Ajouter `outputSchema` + `structuredContent` aux outils dont la sortie est **déjà** une interface nommée et courte du protocole : les gabarits et la miniature.
2. Ne **pas** en donner à `get_project_state` ni `get_screen` : leur forme est la vue complète du projet, et la recopier en JSON Schema créerait exactement la dérive que `createAiTools` existe pour empêcher. Écrire ce refus dans le fichier, pas seulement dans ce plan.
3. Le bloc texte reste dans tous les cas : un client qui ne lit pas `structuredContent` doit continuer à voir la même chose qu'avant.
4. Un refus (`isError`) ne porte jamais de `structuredContent` : une forme valide à côté d'une erreur est une invitation à lire la première et ignorer la seconde.

### `3)` Le test tient le catalogue

> Un titre oublié au prochain outil ajouté doit se voir.

1. Dans `apps/mcp/src/relay.test.ts`, balayer le catalogue enregistré : tout outil sans `title` est un échec.
2. Vérifier qu'un outil qui déclare un `outputSchema` rend bien un `structuredContent`, et qu'aucun n'en rend sans l'avoir déclaré.
3. Lancer `node apps/mcp/src/main.ts` une fois — Node lit ces sources sans les réécrire, et seul l'exécutable le prouve.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------- |
| 1    | Aucun outil enregistré n'est sans `title`, et le test échoue si l'on en retire un.                    |
| 2    | Tout outil déclarant un `outputSchema` rend un `structuredContent` conforme.                          |
| 2    | `get_project_state` et `get_screen` rendent leur bloc texte seul, sans `structuredContent`.           |
| 2    | Un refus ne porte aucun `structuredContent`.                                                          |
| 3    | `pnpm --filter mcp run test:unit` passe, et `node apps/mcp/src/main.ts` démarre en annonçant son port. |
