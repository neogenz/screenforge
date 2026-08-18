import { getAuthUserId } from '@convex-dev/auth/server'
import { inspectMedia } from '@screenforge/project-format/media-validation'
import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { env, httpAction } from './_generated/server'
import { auth } from './auth'
import { webhook } from './billing'
import { MAX_IMAGE_FILE_BYTES, MAX_PROJECT_BLOB_BYTES } from './media'
import { configuredOrigins, isAllowedOrigin } from './origins'

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

const CORS_BASE = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

/**
 * Une variable absente n'ouvre que les origines locales documentées. Une
 * valeur présente doit être une liste d'origines canoniques séparées par des
 * virgules : ni chemin, ni joker, ni HTTP distant. Toute erreur ferme CORS.
 */
function corsHeaders(request: Request): Record<string, string> | null {
  const origin = request.headers.get('Origin')
  if (origin === null) return CORS_BASE
  if (
    !isAllowedOrigin(
      origin,
      configuredOrigins(env.CORS_ALLOWED_ORIGINS),
      env.VERCEL_PREVIEW_HOST_SUFFIX,
    )
  )
    return null
  return { ...CORS_BASE, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
}

const corsRejected = () =>
  new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } })

function json(cors: Record<string, string>, outcome: string, status = 200): Response {
  return new Response(JSON.stringify({ outcome }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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

function denied(cors: Record<string, string>, error: unknown): Response {
  switch (errorCode(error)) {
    case 'UNAUTHENTICATED':
      return json(cors, 'unauthenticated', 401)
    case 'CLOUD_REQUIRED':
      return json(cors, 'cloud-required', 403)
    case 'DELETION_PENDING':
      return json(cors, 'deletion-pending', 409)
    case 'RATE_LIMITED':
      return json(cors, 'rate-limited', 429)
    case 'ASSET_REJECTED':
    case 'PROJECT_REJECTED':
      return json(cors, 'rejected', 400)
    case 'ASSET_SIZE_LIMIT':
    case 'PROJECT_SIZE_LIMIT':
      return json(cors, 'file-too-large', 413)
    case 'ASSET_COUNT_LIMIT':
      return json(cors, 'asset-count-limit', 409)
    case 'PROJECT_COUNT_LIMIT':
      return json(cors, 'project-count-limit', 409)
    case 'ASSET_STORAGE_LIMIT':
      return json(cors, 'asset-storage-limit', 413)
    case 'PROJECT_STORAGE_LIMIT':
      return json(cors, 'project-storage-limit', 413)
    default:
      return json(cors, 'failed', 500)
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
const missing = (cors: Record<string, string>) => new Response(null, { status: 404, headers: cors })

/** La réponse au préflight, identique pour les deux routes de lecture. */
const preflight = httpAction((_ctx, request) => {
  const cors = corsHeaders(request)
  return Promise.resolve(cors ? new Response(null, { status: 204, headers: cors }) : corsRejected())
})

http.route({
  pathPrefix: '/asset/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const cors = corsHeaders(request)
    if (!cors) return corsRejected()
    const userId = await getAuthUserId(ctx)
    const assetId = tail(request.url)
    if (userId === null || assetId === null) return missing(cors)

    let found
    try {
      found = await ctx.runMutation(internal.download.assetStorageId, { assetId })
    } catch (error) {
      return errorCode(error) === 'RATE_LIMITED' ? denied(cors, error) : missing(cors)
    }
    if (!found) return missing(cors)
    const blob = await ctx.storage.get(found.storageId)
    if (!blob) return missing(cors)

    return new Response(blob, {
      headers: {
        ...cors,
        'Content-Type': found.contentType,
        /* Privé : la réponse porte les octets d'un compte, et un cache partagé
           les servirait au suivant qui demande la même URL. */
        'Cache-Control': 'private, no-store',
      },
    })
  }),
})

http.route({ pathPrefix: '/asset/', method: 'OPTIONS', handler: preflight })

http.route({
  pathPrefix: '/project-blob/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const cors = corsHeaders(request)
    if (!cors) return corsRejected()
    const userId = await getAuthUserId(ctx)
    const projectId = tail(request.url)
    if (userId === null || projectId === null) return missing(cors)

    let blobId
    try {
      blobId = await ctx.runMutation(internal.download.projectBlobId, { projectId })
    } catch (error) {
      return errorCode(error) === 'RATE_LIMITED' ? denied(cors, error) : missing(cors)
    }
    if (!blobId) return missing(cors)
    const blob = await ctx.storage.get(blobId)
    if (!blob) return missing(cors)

    return new Response(blob, {
      headers: {
        ...cors,
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
    const cors = corsHeaders(request)
    if (!cors) return corsRejected()
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId') ?? ''
    const name = url.searchParams.get('name') ?? ''
    const updatedAtValue = url.searchParams.get('updatedAt')
    const updatedAt = updatedAtValue === null ? Number.NaN : Number(updatedAtValue)
    const type = contentType(request)
    const length = contentLength(request)
    if (updatedAtValue === null || !Number.isFinite(updatedAt)) return json(cors, 'rejected', 400)

    try {
      await ctx.runMutation(internal.projects.authorizeProjectUpload, {
        projectId,
        name,
        updatedAt,
        contentType: type,
        byteLength: length,
      })
    } catch (error) {
      return denied(cors, error)
    }

    const blob = await request.blob()
    if (type !== 'application/json' || blob.size <= 0 || blob.size > MAX_PROJECT_BLOB_BYTES) {
      return json(cors, 'rejected', blob.size > MAX_PROJECT_BLOB_BYTES ? 413 : 400)
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
      return json(cors, outcome, outcome === 'too-large' ? 413 : 200)
    } catch (error) {
      await ctx.storage.delete(blobId)
      return denied(cors, error)
    }
  }),
})

http.route({ path: '/upload/project', method: 'OPTIONS', handler: preflight })

http.route({
  path: '/upload/asset',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const cors = corsHeaders(request)
    if (!cors) return corsRejected()
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
      return denied(cors, error)
    }

    const body = await request.blob()
    if (body.size <= 0 || body.size > MAX_IMAGE_FILE_BYTES) {
      return json(cors, 'rejected', body.size > MAX_IMAGE_FILE_BYTES ? 413 : 400)
    }
    const bytes = new Uint8Array(await body.arrayBuffer())
    const inspected = inspectMedia(bytes, type)
    if (!inspected) return json(cors, 'rejected', 400)

    const storageId = await ctx.storage.store(new Blob([bytes], { type: inspected.type }))
    try {
      const accepted = await ctx.runMutation(internal.assets.commitAssetUpload, {
        assetId,
        storageId,
        contentType: inspected.type,
      })
      if (!accepted) await ctx.storage.delete(storageId)
      return json(cors, accepted ? 'accepted' : 'rejected', accepted ? 200 : 400)
    } catch (error) {
      await ctx.storage.delete(storageId)
      return denied(cors, error)
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
