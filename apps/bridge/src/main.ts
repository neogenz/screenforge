import { serve } from '@hono/node-server'
import { createServer, createState } from './server.ts'
import { BRIDGE_HOST, BRIDGE_PORT, allowedOrigins } from './protocol.ts'

/**
 * Le point d'entrée : une écoute, sur la boucle locale, et rien d'autre.
 *
 * `hostname` est `127.0.0.1` et non `0.0.0.0` : un pont qui écoute sur toutes
 * les interfaces est un service exposé au réseau local, jeton ou pas. C'est la
 * seule ligne de ce fichier qui compte vraiment.
 */

const state = createState()
const origins = allowedOrigins()

serve(
  { fetch: createServer(state, origins).fetch, hostname: BRIDGE_HOST, port: BRIDGE_PORT },
  () => {
    console.log(`Pont ScreenForge sur http://${BRIDGE_HOST}:${BRIDGE_PORT}`)
    console.log(`Origines admises : ${origins.join(', ')}`)
    console.log(
      `\nJeton d’appairage (version ${state.pairing.version}) :\n${state.pairing.token}\n`,
    )
    console.log('Collez-le dans ScreenForge, section « Assistance ». Il meurt avec ce processus.')
  },
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    state.codex.dispose()
    process.exit(0)
  })
}
