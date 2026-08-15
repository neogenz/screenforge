import { getAuthUserId } from '@convex-dev/auth/server'
import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { auth } from './auth'
import { acceptable } from './assets'
import { webhook } from './billing'
import { MAX_IMAGE_FILE_BYTES, MAX_PROJECT_BLOB_BYTES } from './media'

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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

function json(outcome: string, status = 200): Response {
  return new Response(JSON.stringify({ outcome }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function errorCode(error: unknown): string | null {
  const data: unknown = (error as { data?: unknown })?.data
  if (typeof data === 'object' && data !== null) return (data as { code?: string }).code ?? null
  try {
    const parsed: unknown = JSON.parse(String((error as { message?: string })?.message ?? ''))
    return typeof parsed === 'object' && parsed !== null
      ? ((parsed as { code?: string }).code ?? null)
      : null
  } catch {
    return null
  }
}

function denied(error: unknown): Response {
  switch (errorCode(error)) {
    case 'UNAUTHENTICATED':
      return json('unauthenticated', 401)
    case 'CLOUD_REQUIRED':
      return json('cloud-required', 403)
    case 'DELETION_PENDING':
      return json('deletion-pending', 409)
    case 'RATE_LIMITED':
      return json('rate-limited', 429)
    case 'ASSET_REJECTED':
    case 'PROJECT_REJECTED':
      return json('rejected', 400)
    default:
      return json('failed', 500)
  }
}

function contentLength(request: Request): number | null {
  const value = request.headers.get('Content-Length')
  if (value === null) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : -1
}

function contentType(request: Request): string {
  return (request.headers.get('Content-Type') ?? '').split(';', 1)[0]!.trim().toLowerCase()
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

http.route({
  path: '/upload/project',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId') ?? ''
    const name = url.searchParams.get('name') ?? ''
    const updatedAtValue = url.searchParams.get('updatedAt')
    const updatedAt = updatedAtValue === null ? Number.NaN : Number(updatedAtValue)
    const type = contentType(request)
    const length = contentLength(request)
    if (updatedAtValue === null || !Number.isFinite(updatedAt)) return json('rejected', 400)

    try {
      await ctx.runMutation(internal.projects.authorizeProjectUpload, {
        projectId,
        name,
        updatedAt,
        contentType: type,
        byteLength: length,
      })
    } catch (error) {
      return denied(error)
    }

    const blob = await request.blob()
    if (type !== 'application/json' || blob.size <= 0 || blob.size > MAX_PROJECT_BLOB_BYTES) {
      return json('rejected', blob.size > MAX_PROJECT_BLOB_BYTES ? 413 : 400)
    }

    const blobId = await ctx.storage.store(blob)
    try {
      const outcome = await ctx.runMutation(internal.projects.commitProjectUpload, {
        projectId,
        name,
        updatedAt,
        blobId,
      })
      if (outcome !== 'accepted') await ctx.storage.delete(blobId)
      return json(outcome, outcome === 'too-large' ? 413 : 200)
    } catch (error) {
      await ctx.storage.delete(blobId)
      return denied(error)
    }
  }),
})

http.route({ path: '/upload/project', method: 'OPTIONS', handler: preflight })

http.route({
  path: '/upload/asset',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const assetId = new URL(request.url).searchParams.get('assetId') ?? ''
    const type = contentType(request)
    const length = contentLength(request)

    try {
      await ctx.runMutation(internal.assets.authorizeAssetUpload, {
        assetId,
        contentType: type,
        byteLength: length,
      })
    } catch (error) {
      return denied(error)
    }

    const blob = await request.blob()
    const actualType = blob.type.split(';', 1)[0]!.trim().toLowerCase()
    if (!acceptable(actualType, blob.size) || blob.size > MAX_IMAGE_FILE_BYTES) {
      return json('rejected', blob.size > MAX_IMAGE_FILE_BYTES ? 413 : 400)
    }

    const storageId = await ctx.storage.store(blob)
    try {
      const accepted = await ctx.runMutation(internal.assets.commitAssetUpload, {
        assetId,
        storageId,
        contentType: actualType,
      })
      if (!accepted) await ctx.storage.delete(storageId)
      return json(accepted ? 'accepted' : 'rejected', accepted ? 200 : 400)
    } catch (error) {
      await ctx.storage.delete(storageId)
      return denied(error)
    }
  }),
})

http.route({ path: '/upload/asset', method: 'OPTIONS', handler: preflight })

/**
 * La seule route que quelqu'un d'autre appelle.
 *
 * `path` et non `pathPrefix` : l'URL est celle qu'on inscrit chez Polar, elle ne
 * porte pas de segment variable, et un préfixe accepterait des chemins que
 * personne n'a déclarés.
 */
http.route({ path: '/billing/webhook', method: 'POST', handler: webhook })

export default http
