import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { bearer, createPairing, verifyToken, type Pairing, type PairingOptions } from './pairing.ts'
import {
  allowedOrigins,
  originAllowed,
  relayPairSchema,
  relayResultSchema,
  relayStateSchema,
  RELAY_PROTOCOL,
  type RelayError,
  type RelayHello,
} from './protocol.ts'
import { RelaySession, type AppConnection } from './session.ts'
import { AssetVault, type AssetRootProvider } from './assets.ts'

/**
 * Le relais : une seule page légitime, sur la boucle locale.
 *
 * Le contrôle d'origine passe avant tout le reste et avant le moindre en-tête
 * CORS — un `Origin` refusé repart en 403 nu, donc le navigateur retient la
 * réponse et la page ne lit rien. C'est le contrôle qui compte ici : le jeton
 * voyage, l'origine d'une page non.
 *
 * `/events` prend son jeton en query et non en en-tête, parce que
 * `EventSource` ne sait pas en poser. Le flux ne porte que des demandes
 * destinées à l'onglet qui l'a ouvert ; il ne rend jamais le projet, qui
 * remonte par `POST /state`.
 *
 * `/asset/:id` ne prend jamais de chemin : elle sert la copie immuable qu'un
 * appel d'outil a fait entrer dans le coffre.
 */

export const MCP_VERSION = '0.1.0'
const HEARTBEAT_MS = 15_000

export interface RelayState {
  pairing: Pairing
  session: RelaySession
  assets: AssetVault
}

export function createRelayState(
  pairingOptions?: PairingOptions,
  assetRoots?: AssetRootProvider,
): RelayState {
  return {
    pairing: createPairing(pairingOptions),
    session: new RelaySession(),
    assets: new AssetVault(assetRoots),
  }
}

function fail(code: RelayError['error'], detail: string): RelayError {
  return { error: code, detail }
}

export function createRelay(state: RelayState, origins = allowedOrigins()) {
  const app = new Hono()

  app.use('*', async (context, next) => {
    const origin = context.req.header('Origin')
    if (origin !== undefined && !originAllowed(origin, origins)) {
      return context.json(fail('forbidden-origin', `Origine refusée : ${origin}`), 403)
    }
    if (origin) {
      context.header('Access-Control-Allow-Origin', origin)
      context.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      context.header('Vary', 'Origin')
    }
    if (context.req.method === 'OPTIONS') return context.body(null, 204)
    await next()
  })

  /**
   * L'appairage exige les deux preuves disponibles : origine navigateur admise
   * et code usage unique lu dans le terminal local.
   */
  app.post('/pair', async (context) => {
    const origin = context.req.header('Origin')
    if (!originAllowed(origin, origins)) {
      return context.json(fail('forbidden-origin', 'Appairage refusé.'), 403)
    }
    const parsed = relayPairSchema.safeParse(await context.req.json().catch(() => null))
    const token = parsed.success ? state.pairing.pair(parsed.data.code) : null
    if (!token) return context.json(fail('unauthorized', 'Appairage refusé.'), 401)
    state.session.revoke()
    state.assets.clear()
    const hello: RelayHello = {
      protocol: RELAY_PROTOCOL,
      mcp: MCP_VERSION,
      token,
    }
    return context.json(hello)
  })

  app.post('/revoke', (context) => {
    if (!authorized(state, context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    state.pairing.revoke()
    state.session.revoke()
    state.assets.clear()
    return context.json({ revoked: true })
  })

  app.get('/events', (context) => {
    if (!verifyToken(state.pairing, context.req.query('token'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    return streamSSE(context, async (stream) => {
      const connection: AppConnection = {
        send: (request) => {
          void stream.writeSSE({ event: 'calls', data: JSON.stringify(request) })
        },
        close: () => {
          void stream.close()
        },
      }
      stream.onAbort(() => state.session.detach(connection))
      state.session.attach(connection)
      /* Le battement tient le flux ouvert à travers les proxys et les
         économiseurs d'énergie, et c'est aussi lui qui apprend au démon qu'un
         onglet a disparu : l'écriture échoue, `onAbort` se déclenche, les
         appels en vol repartent en erreur au lieu d'attendre 60 s. */
      while (!stream.closed && !stream.aborted) {
        await stream.sleep(HEARTBEAT_MS)
        if (stream.closed || stream.aborted) break
        await stream.writeSSE({ event: 'ping', data: '' })
      }
      state.session.detach(connection)
    })
  })

  app.post('/result', async (context) => {
    if (!authorized(state, context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    const parsed = relayResultSchema.safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) {
      return context.json(fail('invalid-request', 'Réponse refusée par le schéma du relais.'), 400)
    }
    /* Un identifiant inconnu n'est pas une erreur du client : c'est un appel
       expiré dont la réponse arrive après coup. Il n'y a plus personne à
       réveiller, et rien à signaler. */
    return context.json({ settled: state.session.settle(parsed.data) })
  })

  /**
   * Le fichier local que l'agent a désigné, copié et validé lors de l'offre.
   * Un identifiant absent du coffre est un 404 sans détail — il n'y a rien à
   * apprendre d'une clé qu'on n'a pas.
   */
  app.get('/asset/:id', async (context) => {
    if (!authorized(state, context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    const asset = await state.assets.read(context.req.param('id'))
    if (!asset) return context.json(fail('invalid-request', 'Fichier inconnu du coffre.'), 404)
    return context.body(new Uint8Array(asset.bytes), 200, {
      'Content-Type': asset.mediaType,
      'Cache-Control': 'no-store',
    })
  })

  app.post('/state', async (context) => {
    if (!authorized(state, context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    const parsed = relayStateSchema.safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) {
      return context.json(fail('invalid-request', 'État refusé par le schéma du relais.'), 400)
    }
    state.session.pushState(parsed.data.state)
    return context.json({ received: true })
  })

  return app
}

function authorized(state: RelayState, header: string | undefined): boolean {
  return verifyToken(state.pairing, bearer(header))
}
