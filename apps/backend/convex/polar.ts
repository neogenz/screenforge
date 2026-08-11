'use node'

import { Polar } from '@polar-sh/sdk'
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks.js'
import { ConvexError, v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action, internalAction } from './_generated/server'
import { requireUser } from './authz'
import { projectCustomerState } from './entitlements'
import { consume } from './limits'

/**
 * Tout ce qui parle à Polar, et rien d'autre.
 *
 * Le fichier est `"use node"` en entier pour une raison littérale :
 * `validateEvent` commence par `Buffer.from(secret, 'utf-8')`, et le runtime
 * Convex par défaut n'a pas de `Buffer`. Le contournement — encoder le secret
 * soi-même et appeler `standardwebhooks` directement — ferait perdre l'analyse
 * du SDK, donc le `SDKValidationError` qui porte le type de l'événement reçu,
 * donc la distinction entre « type inconnu » (200) et « état client illisible »
 * (503). C'est cette distinction-là qui empêche d'acquitter une révocation
 * qu'on n'a pas su lire.
 *
 * Les deux actions de vente y sont aussi. Le client Polar, lui, se contenterait
 * du runtime par défaut, mais un second fichier n'existerait que pour épargner
 * quelques centaines de millisecondes de démarrage à une action qui se termine
 * par une redirection vers une page de paiement.
 *
 * Ce fichier n'exporte donc que des actions : Convex n'accepte ni query ni
 * mutation ni `httpAction` dans un module Node. L'enveloppe HTTP du webhook est
 * dans `billing.ts`.
 */

/**
 * Une variable absente doit faire échouer la fonction qui la lit, avec son nom.
 *
 * `env.ts` et son schéma zod validaient tout au démarrage du processus Hono ;
 * une fonction Convex n'a pas de démarrage où se plaindre. Ce qui remplace ce
 * contrôle est `billing.healthcheck`, appelé par un test de déploiement — et
 * cette fonction-ci, qui nomme la variable manquante plutôt que de laisser le
 * SDK échouer sur une chaîne vide.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing Convex environment variable ${name}.`)
  return value
}

export type SellableProduct = 'licence' | 'cloud'

let client: Polar | null = null

function polar(): Polar {
  client ??= new Polar({
    accessToken: required('POLAR_ACCESS_TOKEN'),
    /* `sandbox` a sa propre base d'API, ses propres produits et ses propres
       clés : le même jeton n'ouvre pas les deux. Le défaut est donc le bac à
       sable, pour qu'une variable oubliée ne facture personne. */
    server: process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox',
  })
  return client
}

function productId(product: SellableProduct): string {
  return product === 'licence'
    ? required('POLAR_LICENCE_PRODUCT_ID')
    : required('POLAR_CLOUD_PRODUCT_ID')
}

/** Le code que l'éditeur reconnaît ; la phrase affichée lui appartient. */
export const LICENCE_REQUIRED = 'LICENCE_REQUIRED' as const

/** Le SDK Polar conserve le JSON vérifié quand c'est le schéma qui échoue. */
function invalidEventType(error: unknown): string | null {
  if (!(error instanceof Error) || !('rawValue' in error)) return null
  const raw = error.rawValue
  if (!raw || typeof raw !== 'object' || !('type' in raw) || typeof raw.type !== 'string') {
    return null
  }
  return raw.type
}

/**
 * Ce que le webhook rend à son enveloppe HTTP : les trois issues du miroir, et
 * les trois refus.
 *
 * Un union de littéraux plutôt que l'état client sérialisé. Faire traverser
 * `CustomerState` à la frontière action/`httpAction` obligerait à en déclarer la
 * forme en validateurs Convex et à convertir ses dates dans les deux sens, pour
 * que l'appelant refasse ce que cette action vient de faire. La vérification, la
 * projection et l'écriture restent donc du même côté ; ce qui traverse est la
 * décision.
 */
const outcome = v.union(
  v.literal('written'),
  v.literal('unchanged'),
  v.literal('ignored'),
  v.literal('invalid-signature'),
  v.literal('invalid-state'),
  v.literal('unsupported'),
)

type Applied = 'written' | 'unchanged' | 'ignored'
type Outcome = Applied | 'invalid-signature' | 'invalid-state' | 'unsupported'

/**
 * Le seul chemin par lequel un droit est accordé.
 *
 * On n'écoute que `customer.state_changed` : Polar y sert les abonnements
 * actifs et les bénéfices accordés du client en un objet complet, qui couvre
 * création, changement d'abonnement, octroi et révocation. Recomposer cet
 * état depuis `order.paid` puis `subscription.canceled`, c'est réimplémenter
 * une machine que le fournisseur expose déjà, et diverger au premier webhook
 * perdu.
 */
export const applySignedWebhook = internalAction({
  args: {
    /* Le corps brut, pas l'objet analysé : la signature porte sur les octets
       reçus, et re-sérialiser un JSON ne redonne pas les mêmes. */
    body: v.string(),
    id: v.string(),
    timestamp: v.string(),
    signature: v.string(),
  },
  returns: outcome,
  /* Le type de retour est écrit et non déduit : le module lit `internal`, qui
     se décrit en partie par ce module. TypeScript rend `any` sur un tel cycle,
     et ce `any` se propagerait à `internal.polar` chez tous les appelants. */
  handler: async (ctx, args): Promise<Outcome> => {
    let event
    try {
      event = validateEvent(
        args.body,
        {
          'webhook-id': args.id,
          'webhook-timestamp': args.timestamp,
          'webhook-signature': args.signature,
        },
        required('POLAR_WEBHOOK_SECRET'),
      )
    } catch (error) {
      if (error instanceof WebhookVerificationError) return 'invalid-signature' as const
      /* Un type inconnu mais signé ne deviendra jamais pertinent en le rejouant.
         En revanche, un `customer.state_changed` signé dont le schéma dérive
         porte potentiellement une révocation : l'acquitter perdrait l'état
         payant. Le 503 demande explicitement une nouvelle livraison. */
      const type = invalidEventType(error)
      if (type !== null && type !== 'customer.state_changed') {
        console.warn(`Ignored unsupported Polar webhook type: ${type}.`)
        return 'unsupported' as const
      }
      console.error('Invalid Polar customer state; delivery must be retried.', error)
      return 'invalid-state' as const
    }

    if (event.type !== 'customer.state_changed') return 'unsupported' as const

    const state = event.data
    /* Sans `externalId`, le client Polar n'est rattaché à aucun compte. Cela
       n'arrive que pour un achat créé hors de notre checkout ; il n'y a rien à
       écrire et rien à deviner. */
    if (!state.externalId) return 'ignored' as const

    const { row, cloudRefusedWithoutLicence } = projectCustomerState(state.externalId, state, {
      licenceBenefitId: required('POLAR_LICENCE_BENEFIT_ID'),
      cloudProductId: required('POLAR_CLOUD_PRODUCT_ID'),
    })

    const written: Applied = await ctx.runMutation(internal.mirror.applyEntitlementsIfNewer, {
      userId: row.user_id,
      polarCustomerId: row.polar_customer_id,
      licenceGrantedAt: row.licence_granted_at,
      cloudStatus: row.cloud_status,
      cloudPeriodEnd: row.cloud_period_end,
      /* L'horodatage appartient au message signé par Polar, jamais à l'heure de
         réception : deux livraisons désordonnées se départagent sur ce que
         l'émetteur a daté. */
      sourceUpdatedAt: event.timestamp.getTime(),
    })

    if (written === 'written' && cloudRefusedWithoutLicence) {
      /* Ni une erreur ni un silence : soit un achat effectué hors de notre
         checkout, soit un remboursement de Licence resté à traiter. Les deux
         demandent un humain, aucun ne justifie de renvoyer une erreur à Polar. */
      console.warn(
        `Polar grants cloud without a licence for customer ${state.id}; entitlement refused.`,
      )
    }
    return written
  },
})

/**
 * Ouvre un checkout Polar et rend son URL.
 *
 * `externalCustomerId` porte l'`Id<'users'>` Convex : c'est ce qui relie le
 * client Polar au compte, sans table de correspondance à tenir à jour ni risque
 * qu'elle diverge. Le webhook s'en sert dans l'autre sens.
 */
export const createCheckout = action({
  args: { product: v.union(v.literal('licence'), v.literal('cloud')) },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { product }): Promise<{ url: string }> => {
    const userId = await requireUser(ctx)
    /* Avant tout appel au tiers : chaque checkout crée un objet chez Polar, et
       la route était authentifiée mais illimitée. */
    await consume(ctx, 'checkout', userId)

    const [account, entitlements] = await Promise.all([
      ctx.runQuery(api.users.me, {}),
      ctx.runQuery(api.mirror.myEntitlements, {}),
    ])

    /* La règle « le Cloud exige la Licence », dite une première fois : ici pour
       que l'utilisateur la lise avant de payer, et une seconde fois dans la
       projection, parce qu'un achat créé hors de ce checkout contournerait
       celle-ci. Sans la règle, un an d'add-on à 39 $ achèterait ce que la
       Licence à 49 $ achète, et personne ne paierait la Licence. */
    if (product === 'cloud' && !entitlements?.licence) {
      throw new ConvexError<{ code: typeof LICENCE_REQUIRED }>({ code: LICENCE_REQUIRED })
    }

    const checkout = await polar().checkouts.create({
      products: [productId(product)],
      externalCustomerId: userId,
      customerEmail: account?.email ?? undefined,
      successUrl: required('CHECKOUT_SUCCESS_URL'),
    })
    return { url: checkout.url }
  },
})

/**
 * Le portail client Polar : factures, moyen de paiement, résiliation.
 *
 * Rien de tout cela n'est réimplémenté ici. Un Merchant of Record porte la
 * facturation et la TVA ; lui reprendre l'écran des factures reviendrait à
 * republier des documents dont on n'est pas l'émetteur.
 */
export const createPortalSession = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx): Promise<{ url: string }> => {
    const userId = await requireUser(ctx)
    await consume(ctx, 'checkout', userId)
    const session = await polar().customerSessions.create({ externalCustomerId: userId })
    return { url: session.customerPortalUrl }
  },
})
