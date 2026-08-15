---
objective: "Un agent IA externe (Claude, Codex, opencode) pilote l'application ScreenForge lancée — création d'écrans, calques, visuels, copie de screenshot, templates — via un serveur MCP stdio relayé à l'éditeur ouvert."
status: in-progress
---

# Plan: MCP AI Authoring — pilotage de ScreenForge par un agent externe

## Overview

| Field      | Value                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Serveur MCP local (stdio côté agent, HTTP/SSE 127.0.0.1 côté app) qui expose le vocabulaire `AI_TOOLS` existant et l'applique en live dans l'éditeur ouvert.   |
| **Source** | Texte — demande utilisateur : un MCP pour qu'un agent (Claude, Codex, opencode) intervienne sur l'app lancée ; l'inverse (app → LLM via bridge) existe déjà.   |

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Package partagé `project-format` (types + validation + tools)| [`phase-1.md`](./phase-1.md) |
| 2   | Démon MCP `apps/mcp` — stdio agent + relais HTTP/SSE         | [`phase-2.md`](./phase-2.md) |
| 3   | Côté web — mode MCP, pairing, application live + UI          | [`phase-3.md`](./phase-3.md) |
| 4   | Observation & assets — miniatures, images locales      | [`phase-4.md`](./phase-4.md) |
| 5   | Templates runtime générés par IA                       | [`phase-5.md`](./phase-5.md) |
| 6   | Skill agent « utiliser le MCP ScreenForge »            | [`phase-6.md`](./phase-6.md) |

## Resources

| Source                                                                                  | Verified                                                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server                    | Quickstart officiel 2026 : package `@modelcontextprotocol/server`, `McpServer` + `registerTool` (zod), `StdioServerTransport`, règle stderr-only en stdio, config `claude_desktop_config.json`. |
| https://modelcontextprotocol.io/extensions/apps/overview                                | Extension MCP Apps (UI sandboxée dans le client IA) — évaluée et écartée pour le live, voir Decisions. |
| `apps/web/src/lib/ai/tools.ts` (in-repo)                                                | Vocabulaire fermé `AI_TOOLS` + `validateToolCall` + `applyToolCalls` : le contrat exact que le MCP expose ; déjà sandboxé, validé, undoable via `commitAiRun`. |
| `apps/bridge/src/server.ts` + `pairing.ts` (in-repo)                                    | Modèle de démon local à copier : 127.0.0.1 only, tokens bearer par capacité, allowlist d'Origin. Le bridge reste sans mutation de projet — le MCP est un process séparé. |

## Decisions

| Decision                                                                                          | Why                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un process `apps/mcp` unique : stdio vers l'agent + serveur HTTP/SSE 127.0.0.1 vers l'app        | Le navigateur ne peut pas recevoir de connexions entrantes ; l'app sortante (SSE + POST) résout le relais sans extension navigateur ni backend.        |
| Le MCP expose `AI_TOOLS` tel quel, schémas partagés via `packages/project-format`                | Zéro duplication de contrat : le validateur côté MCP et l'exécuteur côté app sont la même spec ; le catalogue fermé reste le garde-fou anti-injection. |
| Process séparé du bridge, même threat model (127.0.0.1, bearer, Origin allowlist)                 | Le bridge refuse explicitement les mutations de projet ; on étend le pattern, pas le bridge.                                                         |
| MCP Apps (iframe sandboxée dans le client IA) écarté                                              | L'éditeur Fabric/IndexedDB ne tient pas dans une iframe sandboxée sans backend ; l'app existante reste la surface d'exécution. Réévaluable si backend. |
| Mode offline (génération `.screenforge.zip`) différé, non planifié                                | L'import portable existe déjà et ne demande aucun code app ; si besoin, un tool `build_project` réutilisant `packages/project-format` se greffera sur `apps/mcp`. |
