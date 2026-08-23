# CLI

Two optional local daemons. Neither is a user-facing command-line tool: each is a process an agent or the editor talks to, started from a terminal and dying with it.

## Commands

- `pnpm --filter mcp run start` (`apps/mcp/src/main.ts`) — the MCP daemon. One process, two faces: stdio toward the agent, HTTP toward the editor. A browser cannot be an MCP server, so this is what avoids a browser extension or a backend.
- `pnpm --filter bridge run start` (`apps/bridge/src/main.ts`) — the assistant and publication bridge.
- Both commands are exported from the editor, not retyped: `MCP_COMMAND` in `lib/mcp/client.ts` and `BRIDGE_COMMAND` in `lib/ai/providers.ts`, so the dialog, the landing page and the memory cannot drift from what actually starts.
- `pnpm run dev` on either package is the same entry under `node --watch`.
- The MCP tool surface is registered in `apps/mcp/src/tools/editor-tools.ts` — a prefixed table plus a few hand-written tools. Read it there; the list moves.

## Interface

- Both listen on `127.0.0.1` only, never `0.0.0.0`: a daemon on every interface is a service exposed to the local network, token or not. Ports are `4590` (bridge) and `4591` (relay, `SCREENFORGE_MCP_PORT` to move it).
- Pairing is per capability, not per process. The bridge prints two independent tokens — `assistant` for writing copy, `asc-publish` for uploading a frozen batch to Apple — and says what each one opens, so copying only the first leaves publication closed, which is the desirable default. The relay prints a six-digit code instead: single use, five minutes, five attempts per window, exchanged once for an in-memory bearer.
- Tokens live in memory and die with the process. Revocation bumps a version, which invalidates that capability's token without touching the other.
- **The MCP daemon writes nothing to `stdout`.** That is the JSON-RPC channel; a stray `console.log` corrupts a frame and the agent loses the connection with nothing to say about it. Every message goes to `stderr`, which MCP clients show in their logs.
- Environment: `SCREENFORGE_MCP_{PORT,ORIGINS,ASSET_ROOTS}`, `SCREENFORGE_BRIDGE_ORIGINS`, `SCREENFORGE_{CLAUDE,ASC}_BIN`. Origin variables add a local deployment, never a wildcard.

## Distribution

- Not on npm. `apps/mcp` declares a `screenforge-mcp` bin over its `build/` output, but the shipped path is cloning the repository and running the command; `.mcp.json` at the root registers the daemon from source for agents already working here.
- Neither package is published. Both are consumed from source inside the workspace: `apps/web` imports only their protocol types, so a renamed route breaks the editor at compile time while nothing of the daemons reaches the browser.
- **Both daemons run from source, not from a build.** `node src/main.ts` strips types without rewriting them, so nothing that needs emit — constructor parameter properties, `enum`, `namespace` — may appear in `apps/bridge/src` or `apps/mcp/src`. Vitest compiles properly and will not catch it.
- `pnpm run probe:mcp` spawns the real MCP daemon and is part of `pnpm test`, so the MCP half is covered. **The bridge has no equivalent** — start it once by hand after touching its source.
