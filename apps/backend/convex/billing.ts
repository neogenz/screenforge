import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, httpAction, internalQuery } from './_generated/server'

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

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const webhook = httpAction(async (ctx, request) => {
  const outcome = await ctx.runAction(internal.polar.applySignedWebhook, {
    body: await request.text(),
    id: request.headers.get('webhook-id') ?? '',
    timestamp: request.headers.get('webhook-timestamp') ?? '',
    signature: request.headers.get('webhook-signature') ?? '',
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
