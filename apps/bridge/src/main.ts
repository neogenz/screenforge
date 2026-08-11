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
    /* Deux jetons, affichés séparément : ne recopier que le premier laisse la
       publication fermée, ce qui est le défaut souhaitable. */
    console.log(
      `\nJeton « codex » (version ${state.pairing.codex.version}) :\n${state.pairing.codex.token}`,
    )
    console.log('  → ScreenForge, section « Assistance » : composer et traduire.\n')
    console.log(
      `Jeton « asc-publish » (version ${state.pairing['asc-publish'].version}) :\n${state.pairing['asc-publish'].token}`,
    )
    console.log('  → ScreenForge, boîte « Publier » : téléverser un lot figé chez Apple.\n')
    console.log('Les deux meurent avec ce processus. N’en collez que ce dont vous avez besoin.')
  },
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    state.codex.dispose()
    process.exit(0)
  })
}
