import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'

/**
 * Le schéma, validé à la poussée et pas au premier appel.
 *
 * Convex refuse un déploiement dont les documents existants ne satisfont pas le
 * schéma : il n'y a donc pas d'étape de migration à écrire, mais il n'y a pas
 * non plus de champ qu'on peut resserrer sans regarder les données. Ce fichier
 * est l'endroit où l'on regarde.
 *
 * `authTables` apporte `users`, `authAccounts`, `authSessions`,
 * `authRefreshTokens`, `authVerificationCodes`, `authVerifiers` et
 * `authRateLimits`. On ne les redéclare pas : leur forme appartient à la
 * bibliothèque, et la figer ici la casserait à sa prochaine version.
 */
export default defineSchema({
  ...authTables,

  /**
   * Le miroir des droits : ce que Polar dit, recopié ici pour que l'éditeur
   * n'ait jamais à demander à Polar.
   *
   * Deux droits indépendants et jamais un « plan » : la Licence est un achat
   * unique et perpétuel, le Cloud un abonnement annuel qui a une fin de
   * période. Une colonne d'énumération ne pourrait pas porter « a payé une
   * fois, et est abonné depuis mars ».
   *
   * - **Dates en ISO** et non en millisecondes : elles ne sont jamais comparées
   *   par la base — aucun index ne les porte, `toEntitlements` les analyse à la
   *   lecture — et c'est déjà la forme du contrat client. Les stocker en nombre
   *   aurait ajouté deux conversions à chaque bout pour rien.
   * - **`sourceUpdatedAt` en nombre**, lui, parce qu'il *est* comparé : c'est
   *   la garde qui empêche un webhook en retard d'écraser un plus récent.
   * - **`cloudStatus` en texte libre**, comme la colonne d'origine : c'est la
   *   valeur d'un tiers, et une union de littéraux casserait à la première
   *   valeur que Polar ajoute.
   * - **Un index sur `userId`** et non l'`_id` comme clé : Convex ne permet pas
   *   de choisir la clé primaire, donc l'unicité « un compte, une ligne, pour
   *   toujours » n'est plus structurelle et est tenue par l'écriture — voir
   *   `applyEntitlementsIfNewer`.
   */
  entitlements: defineTable({
    userId: v.id('users'),
    polarCustomerId: v.string(),
    licenceGrantedAt: v.union(v.string(), v.null()),
    cloudStatus: v.union(v.string(), v.null()),
    cloudPeriodEnd: v.union(v.string(), v.null()),
    sourceUpdatedAt: v.union(v.number(), v.null()),
  }).index('by_user', ['userId']),
})
