import { Hono } from 'hono'
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks.js'
import { z } from 'zod'
import { env } from '../env.ts'
import { requireAuth, type AuthVariables } from '../middleware/auth.ts'
import { applyCustomerState, readEntitlements } from '../mirror.ts'
import { polar, productId } from '../polar.ts'

const checkoutBody = z.object({ product: z.enum(['licence', 'cloud']) })

export const billing = new Hono<{ Variables: AuthVariables }>()

  /**
   * Ouvre un checkout Polar et rend son URL.
   *
   * `externalCustomerId` porte l'`id` Supabase : c'est ce qui relie le client
   * Polar au compte, sans table de correspondance à tenir à jour ni risque
   * qu'elle diverge. Le webhook s'en sert dans l'autre sens.
   */
  .post('/billing/checkout', requireAuth, async (c) => {
    const parsed = checkoutBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'INVALID_PRODUCT' as const }, 400)

    const user = c.get('user')

    /* La règle « le Cloud exige la Licence », dite une première fois : ici pour
       que l'utilisateur la lise avant de payer, et une seconde fois dans la
       projection, parce qu'un achat créé hors de ce checkout contournerait
       celle-ci. Sans la règle, un an d'add-on à 39 $ achèterait ce que la
       Licence à 49 $ achète, et personne ne paierait la Licence. */
    if (parsed.data.product === 'cloud') {
      const current = await readEntitlements(user.id)
      if (!current.licence) return c.json({ error: 'LICENCE_REQUIRED' as const }, 403)
    }

    const checkout = await polar().checkouts.create({
      products: [productId(parsed.data.product)],
      externalCustomerId: user.id,
      customerEmail: user.email ?? undefined,
      successUrl: env().CHECKOUT_SUCCESS_URL,
    })
    return c.json({ url: checkout.url })
  })

  /**
   * Le portail client Polar : factures, moyen de paiement, résiliation.
   *
   * Rien de tout cela n'est réimplémenté ici. Un Merchant of Record porte la
   * facturation et la TVA ; lui reprendre l'écran des factures reviendrait à
   * republier des documents dont on n'est pas l'émetteur.
   */
  .post('/billing/portal', requireAuth, async (c) => {
    const session = await polar().customerSessions.create({
      externalCustomerId: c.get('user').id,
    })
    return c.json({ url: session.customerPortalUrl })
  })

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
  .post('/billing/webhook', async (c) => {
    /* Le corps brut, pas l'objet analysé : la signature porte sur les octets
       reçus, et re-sérialiser un JSON ne redonne pas les mêmes. */
    const body = await c.req.text()
    const headers = {
      'webhook-id': c.req.header('webhook-id') ?? '',
      'webhook-timestamp': c.req.header('webhook-timestamp') ?? '',
      'webhook-signature': c.req.header('webhook-signature') ?? '',
    }

    let event
    try {
      event = validateEvent(body, headers, env().POLAR_WEBHOOK_SECRET)
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        return c.json({ error: 'INVALID_SIGNATURE' as const }, 403)
      }
      /* Un type d'événement inconnu du SDK fait aussi échouer l'analyse. Le
         refuser en 400 ferait ré-essayer Polar en boucle sur un message qu'on
         ne traitera jamais. */
      console.warn('Unparseable Polar webhook.', error)
      return c.json({ ignored: true as const })
    }

    if (event.type !== 'customer.state_changed') return c.json({ ignored: true as const })

    const { outcome, cloudRefusedWithoutLicence } = await applyCustomerState(
      event.data,
      {
        licenceBenefitId: env().POLAR_LICENCE_BENEFIT_ID,
        cloudProductId: env().POLAR_CLOUD_PRODUCT_ID,
      },
      event.timestamp,
    )

    if (cloudRefusedWithoutLicence) {
      /* Ni une erreur ni un silence : soit un achat effectué hors de notre
         checkout, soit un remboursement de Licence resté à traiter. Les deux
         demandent un humain, aucun ne justifie de renvoyer une erreur à Polar. */
      console.warn(
        `Polar grants cloud without a licence for customer ${event.data.id}; entitlement refused.`,
      )
    }
    return c.json({ outcome })
  })
