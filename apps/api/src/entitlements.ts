/**
 * La projection de l'état client Polar vers le miroir de droits.
 *
 * Deux droits indépendants, jamais un « plan » : la Licence est un achat unique
 * et perpétuel, le Cloud un abonnement annuel qui a une fin de période. Une
 * colonne d'énumération ne peut pas porter « a payé une fois, et est abonné
 * depuis mars ».
 *
 * L'état complet est réécrit à chaque réception, jamais reconstitué depuis une
 * séquence d'événements : Polar sert les abonnements actifs et les bénéfices
 * accordés d'un client en un seul objet, et rejouer `order.paid` puis
 * `subscription.canceled` pour recomposer cet état à la main, c'est
 * réimplémenter une machine que le fournisseur expose déjà — et diverger au
 * premier webhook perdu.
 *
 * Ce fichier est volontairement pur : il ne touche ni au réseau ni à la base,
 * pour que la règle commerciale se teste sans les deux.
 */

/** Ce que la projection lit de l'état client — le reste ne la concerne pas. */
export interface CustomerStateInput {
  id: string
  externalId: string | null
  grantedBenefits: readonly { benefitId: string; grantedAt: Date }[]
  activeSubscriptions: readonly {
    productId: string
    status: string
    currentPeriodEnd: Date | null
    endsAt: Date | null
  }[]
}

export interface ProjectionConfig {
  licenceBenefitId: string
  cloudProductId: string
}

/** La ligne du miroir, telle qu'elle est écrite en base. */
export interface EntitlementsRow {
  user_id: string
  polar_customer_id: string
  licence_granted_at: string | null
  cloud_status: string | null
  cloud_period_end: string | null
}

export interface Projection {
  row: EntitlementsRow
  /**
   * Vrai quand Polar accorde le Cloud à un compte sans Licence. Le droit est
   * refusé et le cas journalisé : il signifie soit un achat effectué hors de
   * notre checkout, soit un remboursement de Licence resté à traiter.
   */
  cloudRefusedWithoutLicence: boolean
}

export function projectCustomerState(
  userId: string,
  state: CustomerStateInput,
  config: ProjectionConfig,
): Projection {
  /* Le plus ancien octroi fait foi : un bénéfice ré-accordé après un incident
     de paiement ne doit pas rajeunir la date d'acquisition de la Licence. */
  const licenceGrants = state.grantedBenefits
    .filter((grant) => grant.benefitId === config.licenceBenefitId)
    .map((grant) => grant.grantedAt.getTime())
  const licenceGrantedAt = licenceGrants.length
    ? new Date(Math.min(...licenceGrants)).toISOString()
    : null

  const cloud = state.activeSubscriptions.find(
    (subscription) => subscription.productId === config.cloudProductId,
  )

  /* La règle « le Cloud exige la Licence » vit ici en plus du checkout, et
     c'est délibéré : un achat passé directement depuis Polar contournerait le
     contrôle d'avant-paiement, et le miroir est le dernier mot. */
  const cloudRefusedWithoutLicence = Boolean(cloud) && licenceGrantedAt === null
  const grantCloud = cloud && licenceGrantedAt !== null

  return {
    row: {
      user_id: userId,
      polar_customer_id: state.id,
      licence_granted_at: licenceGrantedAt,
      cloud_status: grantCloud ? cloud.status : null,
      /* `endsAt` prime : une résiliation le renseigne à la fin de la période en
         cours, et c'est cette date-là que l'utilisateur voit. À défaut, la fin
         de la période courante, qui est aussi la date de renouvellement. */
      cloud_period_end: grantCloud
        ? ((cloud.endsAt ?? cloud.currentPeriodEnd)?.toISOString() ?? null)
        : null,
    },
    cloudRefusedWithoutLicence,
  }
}

/** Les droits tels que le client web les lit. */
export interface Entitlements {
  userId: string
  licence: boolean
  licenceGrantedAt: string | null
  cloud: boolean
  cloudStatus: string | null
  cloudPeriodEnd: string | null
}

export const NO_ENTITLEMENTS = (userId: string): Entitlements => ({
  userId,
  licence: false,
  licenceGrantedAt: null,
  cloud: false,
  cloudStatus: null,
  cloudPeriodEnd: null,
})

/**
 * Le miroir dit ce que Polar disait ; c'est ici qu'on décide si le droit court
 * encore. Une résiliation laisse `cloud_status` à `active` jusqu'à la fin de la
 * période — l'utilisateur a payé l'année, il l'a jusqu'au bout.
 */
export function toEntitlements(
  row: EntitlementsRow | null,
  userId: string,
  now: Date,
): Entitlements {
  if (!row) return NO_ENTITLEMENTS(userId)
  const periodEnd = row.cloud_period_end ? Date.parse(row.cloud_period_end) : null
  const cloud =
    row.licence_granted_at !== null &&
    row.cloud_status !== null &&
    (periodEnd === null || periodEnd > now.getTime())
  return {
    userId,
    licence: row.licence_granted_at !== null,
    licenceGrantedAt: row.licence_granted_at,
    cloud,
    cloudStatus: row.cloud_status,
    cloudPeriodEnd: row.cloud_period_end,
  }
}
