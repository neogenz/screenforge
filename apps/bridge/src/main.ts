import { serve } from '@hono/node-server'
import { claudeVersion } from './claude.ts'
import { createServer, createState } from './server.ts'
import { BRIDGE_HOST, BRIDGE_PORT, allowedOrigins } from './protocol.ts'

/**
 * Le point d'entrée : une écoute, sur la boucle locale, et rien d'autre.
 *
 * `hostname` est `127.0.0.1` et non `0.0.0.0` : un pont qui écoute sur toutes
 * les interfaces est un service exposé au réseau local, jeton ou pas. C'est la
 * seule ligne de ce fichier qui compte vraiment.
 *
 * Ce que ce terminal affiche est la première moitié de l'installation : la page
 * affiche l'autre. Il dit donc, dans l'ordre où on en a besoin, quels
 * assistants il a trouvés, quel jeton sert à quoi, et où le coller — un écran
 * qui se contentait d'imprimer deux chaînes de base64 laissait l'utilisateur
 * choisir entre deux secrets indiscernables.
 */

const state = createState()
const origins = allowedOrigins()

serve(
  { fetch: createServer(state, origins).fetch, hostname: BRIDGE_HOST, port: BRIDGE_PORT },
  async () => {
    console.log(`Pont ScreenForge sur http://${BRIDGE_HOST}:${BRIDGE_PORT}`)
    console.log(`Origines admises : ${origins.join(', ')}\n`)

    const claude = await claudeVersion()
    console.log('Assistants trouvés sur cette machine :')
    console.log(claude ? `  ✓ claude — ${claude}` : '  ✗ claude — introuvable')
    if (!claude) {
      console.log('\n  Claude Code n’est pas installé : le pont tourne sans moteur de rédaction.')
      console.log('  Installez « claude », puis relancez la connexion depuis la page.')
    }

    /* Deux jetons, affichés séparément : ne recopier que le premier laisse la
       publication fermée, ce qui est le défaut souhaitable. */
    console.log(
      `\nJeton « assistant » (version ${state.pairing.assistant.version}) :\n${state.pairing.assistant.token}`,
    )
    console.log('  → ScreenForge, « Qui écrit les accroches » : composer et traduire.\n')
    console.log(
      `Jeton « asc-publish » (version ${state.pairing['asc-publish'].version}) :\n${state.pairing['asc-publish'].token}`,
    )
    console.log('  → ScreenForge, boîte « Publier » : téléverser un lot figé chez Apple.\n')
    console.log('Les deux meurent avec ce processus. N’en collez que ce dont vous avez besoin.')
  },
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    process.exit(0)
  })
}
