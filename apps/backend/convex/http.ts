import { getAuthUserId } from '@convex-dev/auth/server'
import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { auth } from './auth'
import { webhook } from './billing'

/**
 * Les routes HTTP du déploiement, servies sur `<deployment>.convex.site`.
 *
 * `auth.addHttpRoutes` pose `/.well-known/openid-configuration`,
 * `/.well-known/jwks.json`, `/api/auth/signin/*` et `/api/auth/callback/*` —
 * c'est cette dernière que les applications OAuth de Google et de GitHub doivent
 * pointer.
 *
 * Les deux routes de lecture sont ici et pas ailleurs pour une raison de forme :
 * une query rend une valeur Convex, plafonnée à 16 MiB **et** sérialisée en
 * JSON, ce qui ferait voyager un PNG de 16 MiB en base64. Une `httpAction` rend
 * des octets, jusqu'à 20 MiB. La marge sur un import plafonné à 16 MiB est
 * réelle mais mince, et un test pose exactement ce cas.
 */
const http = httpRouter()

auth.addHttpRoutes(http)

/** Le dernier segment du chemin, décodé. */
function tail(url: string): string | null {
  const path = new URL(url).pathname
  const segment = path.slice(path.lastIndexOf('/') + 1)
  return segment.length > 0 ? decodeURIComponent(segment) : null
}

/**
 * Ces octets se lisent depuis un autre hôte que celui qui les sert.
 *
 * L'application tourne sur son propre domaine et le déploiement sur
 * `*.convex.site` : toute lecture est cross-origin, et l'en-tête `Authorization`
 * la fait précéder d'un préflight. Sans réponse à ce préflight, le navigateur
 * refuse la requête avant de l'émettre — un `TypeError: Failed to fetch` où le
 * client attendait un statut.
 *
 * L'origine reste `*` au lieu d'une liste déclarée, et ce n'est pas un
 * relâchement : ces routes n'ont aucune autorité ambiante. Rien n'est porté par
 * un cookie, la seule clé est le jeton lu dans le `localStorage` de
 * l'application, qu'une page tierce ne peut pas lire. Une origine hostile qui
 * demande obtient donc le même 404 que n'importe qui sans jeton. Une liste
 * blanche coûterait une variable d'environnement à tenir juste dans trois
 * déploiements, pour empêcher une requête qui ne rend déjà rien.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
  'Access-Control-Max-Age': '86400',
}

/**
 * L'absence et le refus rendent la même chose, et c'est le point.
 *
 * `storage.getUrl()` a été écarté explicitement : il rend une URL permanente et
 * non révocable, là où tout le reste de ce fichier n'ouvre un fichier que le
 * temps d'une requête authentifiée. Une URL porteuse qui traîne dans un
 * historique de navigation est le même problème avec une étape de plus.
 *
 * Le 404 porte les en-têtes CORS comme les réponses pleines : sans eux le
 * navigateur masque le statut derrière une erreur réseau, et le client ne
 * distinguerait plus « ce projet n'est pas à vous » d'une panne.
 */
const missing = () => new Response(null, { status: 404, headers: CORS })

/** La réponse au préflight, identique pour les deux routes de lecture. */
const preflight = httpAction(() =>
  Promise.resolve(new Response(null, { status: 204, headers: CORS })),
)

http.route({
  pathPrefix: '/asset/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const userId = await getAuthUserId(ctx)
    const assetId = tail(request.url)
    if (userId === null || assetId === null) return missing()

    const found = await ctx.runQuery(internal.download.assetStorageId, { userId, assetId })
    if (!found) return missing()
    const blob = await ctx.storage.get(found.storageId)
    if (!blob) return missing()

    return new Response(blob, {
      headers: {
        ...CORS,
        'Content-Type': found.contentType,
        /* Privé : la réponse porte les octets d'un compte, et un cache partagé
           les servirait au suivant qui demande la même URL. */
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  }),
})

http.route({ pathPrefix: '/asset/', method: 'OPTIONS', handler: preflight })

http.route({
  pathPrefix: '/project-blob/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const userId = await getAuthUserId(ctx)
    const projectId = tail(request.url)
    if (userId === null || projectId === null) return missing()

    const blobId = await ctx.runQuery(internal.download.projectBlobId, { userId, projectId })
    if (!blobId) return missing()
    const blob = await ctx.storage.get(blobId)
    if (!blob) return missing()

    return new Response(blob, {
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        /* Pas de cache : la ligne change à chaque poussée, et l'identifiant du
           projet ne bouge pas avec elle. */
        'Cache-Control': 'no-store',
      },
    })
  }),
})

http.route({ pathPrefix: '/project-blob/', method: 'OPTIONS', handler: preflight })

/**
 * La seule route que quelqu'un d'autre appelle.
 *
 * `path` et non `pathPrefix` : l'URL est celle qu'on inscrit chez Polar, elle ne
 * porte pas de segment variable, et un préfixe accepterait des chemins que
 * personne n'a déclarés.
 */
http.route({ path: '/billing/webhook', method: 'POST', handler: webhook })

export default http
