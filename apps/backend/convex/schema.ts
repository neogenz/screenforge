import { defineSchema } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'

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
})
