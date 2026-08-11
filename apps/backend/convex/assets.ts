import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireCloud } from './authz'
import { consume } from './limits'
import { MAX_IMAGE_FILE_BYTES, isContentImageType } from './media'

/**
 * Les binaires, et le double contrôle qui n'est pas de la ceinture et des
 * bretelles.
 *
 * Le bucket Supabase appliquait `file_size_limit` et `allowed_mime_types`
 * lui-même, à la réception. Convex ne filtre rien : l'URL rendue par
 * `generateUploadUrl` accepte n'importe quel octet, de n'importe quel type, de
 * n'importe quelle taille. Le premier contrôle refuse une intention absurde
 * avant de dépenser une URL ; le second relit les métadonnées **réelles** du
 * fichier déposé et le supprime s'il ment. Sans ce second, le plafond ne serait
 * qu'une politesse côté client.
 *
 * Les deux refusent différemment, et la différence n'est pas cosmétique : le
 * premier lève, parce que rien n'a encore été écrit ; le second **rend une
 * valeur**, parce qu'il vient d'écrire. Une mutation Convex est une
 * transaction : lever après `storage.delete` annulerait la suppression avec le
 * reste et laisserait exactement l'orphelin qu'elle voulait éviter. Le test
 * `supprime et n'enregistre pas un fichier dont le type ment` l'a constaté.
 */

export const ASSET_REJECTED = 'ASSET_REJECTED' as const

function reject(): never {
  throw new ConvexError({ code: ASSET_REJECTED })
}

/** Ce qu'on accepte, quel que soit qui le dit. */
function acceptable(contentType: string | undefined, byteLength: number): boolean {
  return (
    contentType !== undefined &&
    isContentImageType(contentType) &&
    byteLength > 0 &&
    byteLength <= MAX_IMAGE_FILE_BYTES
  )
}

/**
 * Le fichier déposé dit-il la même chose que celui qui l'a annoncé, et les
 * deux disent-ils quelque chose d'acceptable ?
 *
 * Sortie du `handler` pour être appelable seule : `convex-test` n'enregistre
 * pas le `contentType` d'un fichier stocké (son `_storage` ne porte que `size`
 * et `sha256`), donc le simulateur ne peut jouer que le refus. Le côté qui
 * accepte est vérifié ici, sur la règle elle-même — sans cela une règle qui
 * refuserait tout passerait toute la suite en cassant le produit.
 */
export function honest(
  stored: { contentType?: string; size: number } | null,
  announced: { contentType: string; byteLength: number },
): boolean {
  return (
    stored !== null &&
    stored.contentType === announced.contentType &&
    stored.size === announced.byteLength &&
    acceptable(stored.contentType, stored.size)
  )
}

export const requestAssetUpload = mutation({
  args: {
    assetId: v.string(),
    contentType: v.string(),
    byteLength: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, { contentType, byteLength }) => {
    const userId = await requireCloud(ctx)
    if (!acceptable(contentType, byteLength)) reject()
    await consume(ctx, 'assetUpload', userId)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Le fichier est arrivé : on regarde ce que c'est vraiment.
 *
 * Les valeurs annoncées sont redemandées ici plutôt que conservées entre les
 * deux appels, et c'est sans conséquence : ce qui fait autorité est la
 * métadonnée relue dans `_storage`, pas la déclaration. Un client qui mentirait
 * deux fois de façon cohérente échouerait exactement au même endroit.
 *
 * Rend `false` au lieu de lever, et c'est ce qui fait tenir la suppression :
 * lever la ferait annuler avec la transaction. Le client traduit ce `false` en
 * erreur chez lui, où il n'y a plus rien à annuler.
 */
export const confirmAssetUpload = mutation({
  args: {
    assetId: v.string(),
    storageId: v.id('_storage'),
    contentType: v.string(),
    byteLength: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, { assetId, storageId, contentType, byteLength }) => {
    const userId = await requireCloud(ctx)
    const stored = await ctx.db.system.get(storageId)

    if (!honest(stored, { contentType, byteLength })) {
      if (stored) await ctx.storage.delete(storageId)
      return false
    }

    /* Un même `assetId` renvoyé remplace le précédent : le registre binaire est
       dédupliqué par hachage côté éditeur, donc un second envoi signifie une
       reprise après coupure, pas un second contenu. */
    const existing = await ctx.db
      .query('assets')
      .withIndex('by_user_asset', (q) => q.eq('userId', userId).eq('assetId', assetId))
      .unique()
    if (existing) {
      const replaced = existing.storageId
      await ctx.db.patch(existing._id, { storageId, contentType, byteLength })
      if (replaced !== storageId) await ctx.storage.delete(replaced)
    } else {
      await ctx.db.insert('assets', { userId, assetId, storageId, contentType, byteLength })
    }
    return true
  },
})
