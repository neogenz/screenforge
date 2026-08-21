import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, httpAction, internalQuery } from './_generated/server'
import { consume, rateLimitedError, sourceRateLimitKey } from './limits'

/**
 * L'enveloppe HTTP de la vente : le webhook, et l'inventaire des variables.
 *
 * Elle est séparée de `polar.ts` parce que Convex n'accepte pas d'`httpAction`
 * dans un module `"use node"`. Ce qui se décide est là-bas ; ce qui se traduit
 * en statuts HTTP est ici, et les deux listes de cas se lisent l'une en face de
 * l'autre.
 *
 * Pas d'en-têtes CORS sur cette route, contrairement aux lectures de
 * `http.ts` : Polar appelle de serveur à serveur, aucun navigateur n'émet cette
 * requête, et l'ouvrir à une origine serait ouvrir un préflight à personne.
 * La garde n'est pas l'origine, c'est la signature.
 */

const json = (body: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

export const MAX_WEBHOOK_BYTES = 256 * 1024
const MAX_WEBHOOK_HEADER_BYTES = {
  'webhook-id': 256,
  'webhook-timestamp': 32,
  'webhook-signature': 2048,
} as const

export function webhookHeaders(
  request: Request,
): { id: string; timestamp: string; signature: string } | null {
  const values = Object.entries(MAX_WEBHOOK_HEADER_BYTES).map(([name, max]) => {
    const value = request.headers.get(name)
    return value && new TextEncoder().encode(value).byteLength <= max ? value : null
  })
  if (values.some((value) => value === null)) return null
  const [id, timestamp, signature] = values as [string, string, string]
  return { id, timestamp, signature }
}

async function readWebhookBody(
  request: Request,
): Promise<{ body: string } | { error: 'INVALID_BODY' | 'PAYLOAD_TOO_LARGE'; status: 400 | 413 }> {
  const declared = request.headers.get('Content-Length')
  if (declared !== null) {
    const parsed = Number(declared)
    if (!Number.isSafeInteger(parsed) || parsed < 0) return { error: 'INVALID_BODY', status: 400 }
    if (parsed > MAX_WEBHOOK_BYTES) return { error: 'PAYLOAD_TOO_LARGE', status: 413 }
  }

  if (!request.body) return { error: 'INVALID_BODY', status: 400 }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_WEBHOOK_BYTES) {
      await reader.cancel()
      return { error: 'PAYLOAD_TOO_LARGE', status: 413 }
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { body: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return { error: 'INVALID_BODY', status: 400 }
  }
}

export const webhook = httpAction(async (ctx, request) => {
  try {
    await consume(ctx, 'polarWebhookBySource', await sourceRateLimitKey(ctx, 'polar'))
  } catch (error) {
    const limited = rateLimitedError(error)
    if (limited) {
      return json({ error: 'RATE_LIMITED' }, 429, {
        'Retry-After': String(Math.max(1, Math.ceil(limited.retryAfter / 1000))),
      })
    }
    return json({ error: 'SERVICE_UNAVAILABLE' }, 503)
  }

  const headers = webhookHeaders(request)
  if (headers === null) return json({ error: 'INVALID_HEADERS' }, 400)

  const payload = await readWebhookBody(request)
  if ('error' in payload) return json({ error: payload.error }, payload.status)
  const outcome = await ctx.runAction(internal.polar.applySignedWebhook, {
    body: payload.body,
    id: headers.id,
    timestamp: headers.timestamp,
    signature: headers.signature,
  })

  if (outcome === 'invalid-signature') return json({ error: 'INVALID_SIGNATURE' }, 403)
  /* 503 et non 200 : un `customer.state_changed` illisible porte peut-être une
     révocation, et l'acquitter perdrait l'état payant sans que personne le
     sache. Le statut demande à Polar de relivrer. */
  if (outcome === 'invalid-state') return json({ error: 'INVALID_CUSTOMER_STATE' }, 503)
  if (outcome === 'unsupported') return json({ ignored: true })
  return json({ outcome })
})

/**
 * Les variables sans lesquelles la vente ne fonctionne pas, et celles qui
 * manquent.
 *
 * `env.ts` validait tout au démarrage du processus : « une clé absente doit
 * arrêter le processus au boot, pas produire un 500 au premier achat ». Une
 * fonction Convex n'a pas de démarrage, donc ce contrôle-là ne peut plus être
 * automatique — il devient explicite, et se lance contre un déploiement réel
 * après chaque `convex env set`.
 *
 * `POLAR_SERVER` n'y figure pas : son absence vaut `sandbox`, ce qui est le
 * défaut voulu. Poser la production demande de l'écrire.
 */
const REQUIRED_VARIABLES = [
  'ABUSE_KEY_SECRET',
  'POLAR_ACCESS_TOKEN',
  'POLAR_WEBHOOK_SECRET',
  'POLAR_CLOUD_PRODUCT_ID',
  'CHECKOUT_SUCCESS_URL',
] as const

export const healthcheck = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: () => REQUIRED_VARIABLES.filter((name) => !env[name]),
})
