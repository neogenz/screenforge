# Realtime

Two live channels, both narrow. **Project sync is not one of them** — `lib/sync.ts` states it outright: the project travels as a whole document and a conflict is settled last-writer-wins on `updatedAt`, said plainly rather than disguised as automatic merge resolution.

## Transport

- **SSE, from the MCP relay to the editor.** `GET /events` on `127.0.0.1:4591` (`apps/mcp/src/relay/server.ts`), consumed by an `EventSource` in `apps/web/src/lib/mcp/client.ts`. The direction is what makes it necessary: the browser cannot receive an inbound connection, so it opens an outbound stream the daemon writes calls into.
- **One Convex websocket subscription**, opened by `useQuery(api.users.me)` in `lib/cloud-bridge.tsx`. Everything else on the cloud path is a one-shot `client.query` or `client.mutation` in `lib/cloud.ts`.

## Channels

- `calls` — an editor tool invocation the agent asked for. The editor answers out of band, by `POST /result`.
- `ping` — the heartbeat, and it does more than keep proxies and power savers from closing the stream: a failed write is how the daemon learns a tab is gone. `onAbort` fires, in-flight calls return an error instead of waiting out their timeout.
- The Convex subscription carries auth state only. A second parallel query would open a window where two answers arrive out of order, which is why there is exactly one.

## Conventions

- The stream authenticates on its query string, because `EventSource` cannot set a header. Origin is checked in addition to the token: a token copies, an origin does not.
- Revoking pairing revokes the session and clears the asset cache in the same gesture, so a live stream cannot outlive its authorization.
- The reconnect in `lib/mcp/client.ts` is generation-guarded — a stale stream that comes back must not resurrect a session the user closed.
- `undefined` from `useQuery` means "not known yet", never "nobody". Treating them alike flashes signed-out UI at a signed-in user.
