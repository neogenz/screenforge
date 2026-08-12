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

  /**
   * Le catalogue des projets : leur identité et leur horodatage, jamais leur
   * contenu.
   *
   * Le JSON est un fichier (`blobId`) et pas une colonne, pour deux raisons qui
   * pointent dans le même sens. La contrainte : un document Convex plafonne à
   * 1 MiB, et un projet qui a figé vingt lots porte vingt-et-une copies de son
   * graphe plus jusqu'à douze variantes de langue — `data jsonb` l'acceptait,
   * un document non. Le bénéfice : le serveur n'a **jamais** lu à l'intérieur
   * de ce JSON, le dernier-écrivain-gagne ne tranche que sur `updatedAt`, or
   * l'ancienne lecture descendait l'intégralité des projets par pages de 500
   * pour comparer des dates. Sortir le blob supprime ce gaspillage en même
   * temps que le plafond.
   *
   * `projectId` reste l'identifiant ScreenForge et non l'`_id` Convex : c'est
   * lui qui vit dans IndexedDB, dans le `.screenforge` exporté et dans la file
   * de synchronisation. Le remplacer obligerait le navigateur à tenir une table
   * de correspondance pour rien.
   */
  projects: defineTable({
    userId: v.id('users'),
    projectId: v.string(),
    name: v.string(),
    updatedAt: v.number(),
    blobId: v.id('_storage'),
  })
    .index('by_user', ['userId'])
    .index('by_user_project', ['userId', 'projectId']),

  /**
   * Les binaires, et à qui ils appartiennent.
   *
   * Un fichier Convex n'a pas de chemin où loger l'isolation : la propriété est
   * un champ, et `by_user_asset` est ce qui la rend interrogeable sans balayer
   * la table. Aucune lecture ne prend l'utilisateur en paramètre — il vient du
   * jeton, toujours.
   */
  assets: defineTable({
    userId: v.id('users'),
    assetId: v.string(),
    storageId: v.id('_storage'),
    contentType: v.string(),
    byteLength: v.number(),
  }).index('by_user_asset', ['userId', 'assetId']),

  /**
   * Les suppressions de compte en cours : la barrière, et ce qu'il reste à
   * faire.
   *
   * `userId` en `v.string()` et non en `v.id('users')` : cette ligne doit
   * **survivre à l'identité** qu'elle garde et nettoie, et un `v.id('users')`
   * qui pointe sur un document supprimé est un identifiant qui ne résout plus.
   *
   * Elle porte donc `userId` sans être « possédée » par le compte au sens de
   * `accountDeletion.ts` : c'est la seule table que le balayage ne balaie pas,
   * puisqu'elle est ce qui dit que le balayage n'est pas fini. Le test qui
   * énumère le schéma connaît cette exception, et elle est la seule.
   */
  accountDeletionJobs: defineTable({
    userId: v.string(),
    status: v.union(v.literal('prepared'), v.literal('cleanup')),
    attempts: v.number(),
    lastError: v.union(v.string(), v.null()),
  }).index('by_user', ['userId']),
})
