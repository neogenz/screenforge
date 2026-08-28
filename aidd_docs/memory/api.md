# API

## Style

- Three HTTP surfaces, none of them a public REST API. The editor is the only client of all three.
- **Convex deployment** — RPC by function name (`query`, `mutation`, `action`) through the Convex client, plus a handful of `httpAction` routes registered in `apps/backend/convex/http.ts` and served on `<deployment>.convex.site`.
- **`apps/bridge`** — Hono on `127.0.0.1:4590`, the optional assistant and App Store publication daemon.
- **`apps/mcp`** relay — Hono on `127.0.0.1:4591`, the editor-facing half of the MCP daemon.
- No versioned base path. Both local daemons carry an integer protocol version in their handshake (`PROTOCOL_VERSION`, `RELAY_PROTOCOL`) and refuse a mismatch rather than negotiate.

## Resources

- Convex functions a client can call: account (`users.me`), entitlement mirror (`mirror.myEntitlements`), project and asset sync (`projects`, `assets`), quota and wipe (`cloudData.myUsage`, `clearMyCloudData`), durable preferences (`settings`), sale (`polar`), account deletion (`accountDeletion.requestAccountDeletion`), and `auth.signIn`. Everything else — admission control, billing lifecycle, the PostHog person erasure, the preflight evaluation, the maintenance sweep — is `internalMutation`/`internalAction` and unreachable from any client.
- Convex HTTP: asset and project-blob reads, the two upload routes, the Polar webhook, and the well-known auth routes that `auth.addHttpRoutes` installs.
- Bridge: `/hello` (capabilities and engine probe), `/models`, `/plan`, `/translate`, `/proofread`, `/asc/publish`, `/pair/revoke`, and three read-only listings behind the `asc-publish` token — `GET /asc/apps`, `/asc/versions?app=`, `/asc/localizations?version=` — so the publish dialog offers the destination instead of asking for identifiers.
- Relay: `/pair`, `/revoke`, `/events` (SSE, see `realtime.md`), `/result`, `/asset/:id`, `/state`.

## Contracts

- The schema is the source, not a generated document. `apps/bridge/src/protocol.ts` and `apps/mcp/src/relay/protocol.ts` export Zod schemas that `apps/web` imports as types through the workspace `exports`; the backend exports its generated `api.d.ts` the same way. A renamed function or route breaks the editor at compile time, which is why none of the three publishes an OpenAPI file.
- Bytes never travel through a function return. A Convex document caps at 1 MiB and a query result is JSON-serialized, so a PNG would move as base64; an `httpAction` returns raw bytes with a wider ceiling. That is the whole reason the read and upload routes exist beside the functions.
- Errors are codes, never messages. Convex throws `ConvexError` carrying `UNAUTHENTICATED`, `CLOUD_REQUIRED`, `DELETION_PENDING` or `RATE_LIMITED`; both daemons answer `{ error, detail }` where `error` is a closed union and `detail` is one actionable sentence, never a trace. The displayed wording belongs to the editor.
- Every surface allowlists origins and answers its own `OPTIONS` preflight: `convex/origins.ts` server-side, `allowedOrigins()` in each daemon. A token copied to another page still fails, because the origin cannot be copied.
- No client-facing pagination. The one list a client reads, `projects.listProjects`, is capped by `.take(PROJECT_CATALOGUE_LIMIT)`; only the internal orphan-blob sweep paginates, and it carries its own cursor through the cron.
