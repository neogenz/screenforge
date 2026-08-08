import { serve } from '@hono/node-server'
import { app } from './index.ts'
import { env } from './env.ts'

/**
 * Le point d'entrée déployé.
 *
 * `env()` est appelé avant `serve` pour que le processus meure au boot si une
 * variable manque, plutôt que de répondre 200 à la sonde de santé et 500 au
 * premier achat.
 */
const { PORT } = env()

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API listening on :${info.port}`)
})
