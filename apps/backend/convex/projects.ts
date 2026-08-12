import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireCloud, requireUser } from './authz'
import { consume } from './limits'
import { MAX_PROJECT_BLOB_BYTES } from './media'

/**
 * La sync d'un projet, côté serveur : trois fonctions et pas une de plus.
 *
 * Le modèle ne change pas d'un iota avec la migration — le projet est un
 * document auto-contenu, il part et revient d'un bloc, et le conflit se tranche
 * au dernier écrivain sur `updatedAt`. Ce qui change est le transport, et le
 * fait que le contenu voyage à côté de la ligne plutôt que dedans.
 */

/**
 * Les trois issues d'une poussée.
 *
 * Un refus est une valeur et jamais une exception, et ce n'est pas un choix de
 * style : une mutation Convex est une transaction, donc lever après
 * `storage.delete` annulerait la suppression avec le reste et laisserait
 * l'orphelin qu'on voulait éviter. Le client traduit `too-large` en erreur chez
 * lui, où il n'y a plus rien à annuler.
 */
export const PUSH_OUTCOMES = ['accepted', 'stale', 'too-large'] as const
export type PushOutcome = (typeof PUSH_OUTCOMES)[number]

/**
 * Un emplacement pour déposer le JSON, et le jeton qui va avec.
 *
 * Le compteur est ici et non dans `pushProject` : c'est ce téléversement qui
 * écrit des octets facturés, et une poussée refusée par le
 * dernier-écrivain-gagne supprime les siens tout de suite. Compter au moment de
 * l'écriture borne donc exactement ce qu'il y a à borner, et une seule fois par
 * cycle — `pushProject` ne s'appelle jamais sans être précédé d'ici.
 */
export const beginProjectPush = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await requireCloud(ctx)
    await consume(ctx, 'projectPush', userId)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * La ligne, après ses octets. Rend `stale` quand le serveur porte déjà une
 * version au moins aussi récente.
 *
 * Le dernier écrivain gagne, et la comparaison est atomique sans rien demander
 * de particulier : une mutation Convex est une transaction, donc la lecture et
 * l'écriture ne peuvent pas s'entrelacer avec une autre poussée.
 *
 * C'est aussi le seul endroit du dépôt qui écrit `blobId`, donc le seul qui
 * puisse laisser un fichier orphelin. Les deux sorties le nettoient : un refus
 * supprime le blob qu'on vient de recevoir, une acceptation supprime celui
 * qu'elle remplace.
 */
export const pushProject = mutation({
  args: {
    projectId: v.string(),
    name: v.string(),
    updatedAt: v.number(),
    blobId: v.id('_storage'),
  },
  returns: v.union(...PUSH_OUTCOMES.map((outcome) => v.literal(outcome))),
  handler: async (ctx, { projectId, name, updatedAt, blobId }): Promise<PushOutcome> => {
    const userId = await requireCloud(ctx)

    /* La taille réelle, relue et non crue : l'URL de téléversement accepte
       n'importe quel octet, donc un plafond annoncé côté client ne serait
       qu'une politesse. */
    const blob = await ctx.db.system.get(blobId)
    if (!blob || blob.size > MAX_PROJECT_BLOB_BYTES) {
      if (blob) await ctx.storage.delete(blobId)
      return 'too-large'
    }

    const existing = await ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique()

    if (existing && existing.updatedAt >= updatedAt) {
      await ctx.storage.delete(blobId)
      return 'stale'
    }

    if (existing) {
      const replaced = existing.blobId
      await ctx.db.patch(existing._id, { name, updatedAt, blobId })
      await ctx.storage.delete(replaced)
    } else {
      await ctx.db.insert('projects', { userId, projectId, name, updatedAt, blobId })
    }
    return 'accepted'
  },
})

/**
 * Le catalogue, sans le contenu.
 *
 * C'est ce qui remplace `fetchRemoteProjectRows` et sa pagination par 500 : la
 * liste est petite parce qu'elle ne porte que des métadonnées, et le tirage ne
 * descend que les projets dont l'horodatage bat la copie locale.
 *
 * `requireUser` et non `requireCloud` : « un abonnement qui se termine ne doit
 * emporter aucune donnée », et savoir ce qu'on a déposé fait partie de ce qu'on
 * ne perd pas.
 */
export const listProjects = query({
  args: {},
  returns: v.array(v.object({ projectId: v.string(), name: v.string(), updatedAt: v.number() })),
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const rows = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    return rows.map(({ projectId, name, updatedAt }) => ({ projectId, name, updatedAt }))
  },
})

/**
 * Supprimer reste ouvert sans droit `cloud`, comme la lecture, et pour la même
 * raison : retenir en otage des fichiers qu'on ne synchronise plus serait pire
 * que de ne rien synchroniser.
 */
export const removeProject = mutation({
  args: { projectId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { projectId }) => {
    const userId = await requireUser(ctx)
    const existing = await ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique()
    if (!existing) return false
    await ctx.storage.delete(existing.blobId)
    await ctx.db.delete(existing._id)
    return true
  },
})
