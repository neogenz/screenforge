/**
 * La règle commerciale, une fois pour toutes.
 *
 * Un seul fichier décide de ce qu'un compte a le droit de faire, et le serveur
 * comme l'éditeur l'importent. Deux copies de cette règle finiraient par
 * répondre différemment, et l'éditeur qui afficherait un droit que le
 * déploiement refuse montrerait une erreur de sync à quelqu'un qui n'a rien
 * fait de mal.
 *
 * Rien n'oblige à la dédoubler : le client ne peut appeler que des fonctions
 * écrites ici, il n'existe donc aucun chemin vers les données qui contournerait
 * ce fichier et demanderait son propre verrou.
 *
 * Il reste volontairement pur — ni réseau, ni base, ni `ctx` — parce que c'est
 * exactement ce qui le rend partageable entre les deux, et testable sans aucun
 * des deux.
 */

/** Ce que la projection lit de l'état client Polar — le reste ne la concerne pas. */
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

/**
 * La ligne du miroir : la sortie de la projection, et l'entrée de l'écriture.
 *
 * Les champs sont en `snake_case` et les dates en ISO : c'est la forme que le
 * webhook produit et que `toEntitlements` consomme. La renommer ne déplacerait
 * la conversion qu'un cran plus loin, dans les deux sens.
 */
export interface EntitlementsRow {
  user_id: string
  polar_customer_id: string
  licence_granted_at: string | null
  cloud_status: string | null
  cloud_period_end: string | null
}

export interface Projection {
  row: EntitlementsRow
}

export function projectCustomerState(
  userId: string,
  state: CustomerStateInput,
  config: ProjectionConfig,
): Projection {
  /* Le plus ancien octroi fait foi : un bénéfice ré-accordé après un incident
     de paiement ne doit pas rajeunir la date d'acquisition de Local. */
  const licenceGrants = state.grantedBenefits
    .filter((grant) => grant.benefitId === config.licenceBenefitId)
    .map((grant) => grant.grantedAt.getTime())
  const licenceGrantedAt = licenceGrants.length
    ? new Date(Math.min(...licenceGrants)).toISOString()
    : null

  const cloud = state.activeSubscriptions.find(
    (subscription) => subscription.productId === config.cloudProductId,
  )

  return {
    row: {
      user_id: userId,
      polar_customer_id: state.id,
      licence_granted_at: licenceGrantedAt,
      cloud_status: cloud?.status ?? null,
      /* `endsAt` prime : une résiliation le renseigne à la fin de la période en
         cours, et c'est cette date-là que l'utilisateur voit. À défaut, la fin
         de la période courante, qui est aussi la date de renouvellement. */
      cloud_period_end: cloud
        ? ((cloud.endsAt ?? cloud.currentPeriodEnd)?.toISOString() ?? null)
        : null,
    },
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
 * Le Cloud court-il encore ? La seule expression de la question.
 *
 * Trois conditions, et la troisième est la moins évidente : une résiliation
 * laisse `cloud_status` à `active` jusqu'à la fin de la période — l'utilisateur
 * a payé l'année, il l'a jusqu'au bout. Une période absente vaut « sans fin
 * connue », donc en cours.
 *
 * Elle est extraite plutôt qu'écrite dans `toEntitlements` parce que le cache
 * hors-ligne de l'éditeur pose exactement la même question sur des données
 * qu'il a lui-même conservées, et la reposait à sa façon.
 */
export function isCloudActive(
  cloudStatus: string | null,
  cloudPeriodEnd: string | null,
  nowMs: number,
): boolean {
  if (cloudStatus === null) return false
  const periodEnd = cloudPeriodEnd ? Date.parse(cloudPeriodEnd) : null
  return periodEnd === null || periodEnd > nowMs
}

/**
 * Le miroir dit ce que Polar disait ; c'est ici qu'on décide si le droit court
 * encore.
 */
export function toEntitlements(
  row: EntitlementsRow | null,
  userId: string,
  now: Date,
): Entitlements {
  if (!row) return NO_ENTITLEMENTS(userId)
  const licence = row.licence_granted_at !== null
  return {
    userId,
    licence,
    licenceGrantedAt: row.licence_granted_at,
    cloud: isCloudActive(row.cloud_status, row.cloud_period_end, now.getTime()),
    cloudStatus: row.cloud_status,
    cloudPeriodEnd: row.cloud_period_end,
  }
}

/**
 * Ce que chaque palier ouvre.
 *
 * Une seule traduction des droits achetés vers les droits d'usage, lue partout
 * ailleurs : sans elle, « a la Licence » se retesterait dans le chemin d'export,
 * dans la boîte d'export, dans la barre du haut, et l'un des trois finirait par
 * dire autre chose que les deux autres.
 *
 * `billingOpen` est un paramètre et non une constante lue ici : c'est un
 * interrupteur de compilation du navigateur, et le serveur n'en a pas
 * l'équivalent. L'éditeur le lie à son drapeau, ce fichier ne connaît que la
 * règle.
 */
export const FREE_EXPORTS_PER_PROJECT = 3

export interface Rights {
  /** Exporter sans filigrane, et sans limite de nombre. */
  cleanExport: boolean
  /** Le ZIP groupé, un fichier par planche, prêt pour App Store Connect. */
  zip: boolean
  /** La synchronisation des projets — le seul droit qui coûte tous les mois. */
  sync: boolean
}

export function rightsOf(entitlements: Entitlements | null, billingOpen: boolean): Rights {
  /* Avant l'ouverture de la vente, le produit historique reste le produit
     entier : exports propres illimités et ZIP, mais jamais la sync payante. Le
     même drapeau cache le checkout et les prix, donc l'offre et son application
     basculent ensemble au lieu de créer un palier gratuit sans moyen d'en
     sortir. */
  if (!billingOpen) return { cleanExport: true, zip: true, sync: false }
  const paid = (entitlements?.licence ?? false) || (entitlements?.cloud ?? false)
  return {
    cleanExport: paid,
    zip: paid,
    /* La synchronisation reste la seule capacité réservée au Cloud actif. */
    sync: entitlements?.cloud ?? false,
  }
}
