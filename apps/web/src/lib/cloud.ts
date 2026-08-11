import type { Entitlements } from 'backend/entitlements'
import type { GenericId } from 'convex/values'
import { getConvex } from '@/lib/convex'
import { JWT_STORAGE_KEY } from '@/lib/session-keys'
import type { Project } from '@/types'

/**
 * Le transport, et rien que le transport.
 *
 * `lib/sync.ts` décide quoi envoyer et quand ; ce fichier sait seulement
 * comment. La séparation existe parce que la migration ne change que la seconde
 * moitié — le modèle (document auto-contenu, dernier écrivain gagne sur
 * `updatedAt`, jamais bloquant) est identique — et parce qu'un module qui
 * mélangeait les deux rendait impossible de dire lequel avait cassé.
 *
 * Rien ici n'est importé statiquement par le paquet critique : `getConvex()`
 * rend `null` sans instance configurée, et l'`import()` du SDK n'a alors jamais
 * lieu. C'est l'invariant que `e2e/boot-shell.spec.ts` mesure.
 */

/**
 * L'origine des routes HTTP, dérivée de celle des fonctions.
 *
 * Convex sert les `httpAction` sur un hôte distinct de celui des fonctions :
 * `.convex.site` au lieu de `.convex.cloud` en ligne, le port suivant en local.
 * Dérivée plutôt que configurée, parce qu'une seconde variable à poser dans
 * trois environnements est une seconde variable à oublier dans l'un des trois.
 */
function siteOrigin(url: string): string {
  return url.replace(/\.convex\.cloud$/, '.convex.site').replace(/:3210$/, ':3211')
}

interface Link {
  client: Awaited<NonNullable<ReturnType<typeof getConvex>>>
  api: (typeof import('backend'))['api']
  site: string
}

let link: Promise<Link> | null = null

/**
 * Le client, l'API générée et l'origine HTTP — ou `null`, jamais une promesse
 * rejetée : l'absence de cloud n'est pas une panne.
 *
 * Exportée pour `lib/api.ts`, qui ouvre les checkouts : c'est le même
 * déploiement, le même client et le même jeton, et une seconde fonction de
 * connexion serait une seconde WebSocket ouverte sur la même chose.
 */
export function connect(): Promise<Link> | null {
  const pending = getConvex()
  if (!pending) return null
  link ??= Promise.all([pending, import('backend')]).then(([client, module]) => ({
    client,
    api: module.api,
    site: siteOrigin(client.url),
  }))
  return link
}

/**
 * Le jeton porté par les routes HTTP.
 *
 * Il est lu au moment de l'appel et non conservé : `@convex-dev/auth` le
 * renouvelle en place, et une copie prise à l'ouverture de session expirerait
 * au milieu d'un tirage un peu long.
 */
function bearer(): string | null {
  try {
    return localStorage.getItem(JWT_STORAGE_KEY)
  } catch {
    return null
  }
}

class CloudError extends Error {}

async function download(path: string): Promise<Blob | null> {
  const connected = connect()
  if (!connected) throw new CloudError('Cloud is not configured on this instance.')
  const { site } = await connected
  const token = bearer()
  if (!token) throw new CloudError('No session token to read cloud data with.')

  const response = await fetch(`${site}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  /* 404 vaut « rien ici », pour moi comme pour un autre : c'est ce qui empêche
     un balayage d'identifiants de distinguer l'inexistant de l'interdit. */
  if (response.status === 404) return null
  if (!response.ok) throw new CloudError(`Cloud read failed with ${String(response.status)}.`)
  return await response.blob()
}

/** Dépose des octets à l'URL rendue par une mutation, et rend leur identifiant. */
async function upload(uploadUrl: string, blob: Blob): Promise<GenericId<'_storage'>> {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  })
  if (!response.ok) throw new CloudError(`Upload failed with ${String(response.status)}.`)
  const { storageId } = (await response.json()) as { storageId: GenericId<'_storage'> }
  return storageId
}

/**
 * Les droits du compte, lus au même endroit que le reste.
 *
 * `null` n'est pas « aucun droit » mais « la question ne se pose pas » : pas
 * d'instance configurée, ou pas de session. L'appelant les distingue — un
 * filigrane posé pendant qu'une session se restaure serait un faux reproche.
 */
export async function fetchRemoteEntitlements(): Promise<Entitlements | null> {
  const connected = connect()
  if (!connected) return null
  const { client, api } = await connected
  return await client.query(api.mirror.myEntitlements, {})
}

export interface RemoteProject {
  projectId: string
  name: string
  updatedAt: number
}

export async function listRemoteProjects(): Promise<RemoteProject[]> {
  const connected = connect()
  if (!connected) return []
  const { client, api } = await connected
  return await client.query(api.projects.listProjects, {})
}

/** Le JSON d'un projet distant, ou `null` s'il n'y en a plus. */
export async function fetchRemoteProject(projectId: string): Promise<unknown | null> {
  const blob = await download(`/project-blob/${encodeURIComponent(projectId)}`)
  return blob ? (JSON.parse(await blob.text()) as unknown) : null
}

/**
 * Le projet, ses octets d'abord et sa ligne ensuite. Rend `false` quand le
 * serveur portait déjà une version au moins aussi récente.
 */
export async function pushRemoteProject(project: Project, payload: unknown): Promise<boolean> {
  const connected = connect()
  if (!connected) throw new CloudError('Cloud is not configured on this instance.')
  const { client, api } = await connected

  const uploadUrl = await client.mutation(api.projects.beginProjectPush, {})
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const blobId = await upload(uploadUrl, blob)

  const outcome = await client.mutation(api.projects.pushProject, {
    projectId: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    blobId,
  })
  /* `too-large` est une erreur ici et une valeur là-bas : le serveur ne peut
     pas lever sans annuler la suppression du fichier qu'il vient de refuser. */
  if (outcome === 'too-large') throw new CloudError(`Project ${project.id} is too large to sync.`)
  return outcome === 'accepted'
}

export async function uploadRemoteAsset(assetId: string, blob: Blob): Promise<void> {
  const connected = connect()
  if (!connected) throw new CloudError('Cloud is not configured on this instance.')
  const { client, api } = await connected

  const contentType = blob.type
  const byteLength = blob.size
  const uploadUrl = await client.mutation(api.assets.requestAssetUpload, {
    assetId,
    contentType,
    byteLength,
  })
  const storageId = await upload(uploadUrl, blob)
  /* La confirmation est une seconde mutation et pas un simple `await` sur la
     première : entre les deux, le serveur relit la taille et le type réels du
     fichier déposé, et le supprime s'ils ne tiennent pas. Il rend `false`
     plutôt que de lever, pour que cette suppression survive à la transaction ;
     l'erreur se lève donc ici. */
  const confirmed = await client.mutation(api.assets.confirmAssetUpload, {
    assetId,
    storageId,
    contentType,
    byteLength,
  })
  if (!confirmed) throw new CloudError(`Cloud refused asset ${assetId}.`)
}

export async function downloadRemoteAsset(assetId: string): Promise<Blob> {
  const blob = await download(`/asset/${encodeURIComponent(assetId)}`)
  if (!blob) throw new CloudError(`Missing remote asset ${assetId}.`)
  return blob
}

export async function removeRemoteProject(projectId: string): Promise<boolean> {
  const connected = connect()
  if (!connected) return false
  const { client, api } = await connected
  return await client.mutation(api.projects.removeProject, { projectId })
}
