import type { Entitlements } from 'backend/entitlements'
import { getConvex } from '@/lib/convex'
import { JWT_STORAGE_KEY } from '@/lib/session-keys'
import type { UserSettings } from '@/lib/user-settings'
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

export class CloudUploadError extends CloudError {
  constructor(readonly outcome: string) {
    super(`Cloud upload refused (${outcome}).`)
  }
}

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

/** Envoie les octets à l'action authentifiée; l'identifiant Storage reste serveur. */
async function upload(path: string, blob: Blob): Promise<string> {
  const connected = connect()
  if (!connected) throw new CloudError('Cloud is not configured on this instance.')
  const { site } = await connected
  const token = bearer()
  if (!token) throw new CloudError('No session token to write cloud data with.')

  const response = await fetch(`${site}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
  })
  const { outcome } = (await response.json().catch(() => ({}))) as { outcome?: string }
  if (!response.ok || !outcome) {
    throw new CloudUploadError(outcome ?? 'failed')
  }
  return outcome
}

/**
 * Les droits du compte, lus au même endroit que le reste.
 *
 * `null` n'est pas « aucun droit » mais « la question ne se pose pas » : pas
 * d'instance configurée, ou pas de session. L'appelant les distingue — un
 * filigrane posé pendant qu'une session se restaure serait un faux reproche.
 *
 * L'instant est passé à chaque appel : une query Convex ne se rejoue pas parce
 * que le temps avance, donc c'est la lecture qui doit dater la question pour que
 * la fin d'un abonnement se voie sans attendre qu'une donnée bouge.
 */
export async function fetchRemoteEntitlements(): Promise<Entitlements | null> {
  const connected = connect()
  if (!connected) return null
  const { client, api } = await connected
  return await client.query(api.mirror.myEntitlements, { now: Date.now() })
}

export async function fetchRemoteUserSettings(): Promise<UserSettings | null> {
  const connected = connect()
  if (!connected) return null
  const { client, api } = await connected
  return await client.query(api.settings.mySettings, {})
}

export interface CloudUsageRow {
  count: number
  bytes: number
  limitCount: number
  limitBytes: number
}

export interface CloudUsage {
  projects: CloudUsageRow
  assets: CloudUsageRow
}

export async function fetchRemoteCloudUsage(): Promise<CloudUsage | null> {
  const connected = connect()
  if (!connected) return null
  const { client, api } = await connected
  return await client.query(api.cloudData.myUsage, {})
}

export async function clearRemoteCloudData(): Promise<'cleared' | 'incomplete'> {
  const connected = connect()
  if (!connected) return 'incomplete'
  const { client, api } = await connected
  for (let pass = 0; pass < 8; pass += 1) {
    const outcome = await client.mutation(api.cloudData.clearMyCloudData, {})
    if (outcome === 'cleared') return outcome
  }
  return 'incomplete'
}

export async function pushRemoteUserSettings(settings: UserSettings): Promise<boolean> {
  const connected = connect()
  if (!connected) return false
  const { client, api } = await connected
  return (await client.mutation(api.settings.upsertSettings, settings)) === 'accepted'
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
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const query = new URLSearchParams({
    projectId: project.id,
    name: project.name,
    updatedAt: String(project.updatedAt),
  })
  const outcome = await upload(`/upload/project?${query.toString()}`, blob)
  return outcome === 'accepted'
}

export async function uploadRemoteAsset(assetId: string, blob: Blob): Promise<void> {
  const query = new URLSearchParams({ assetId })
  const outcome = await upload(`/upload/asset?${query.toString()}`, blob)
  if (outcome !== 'accepted') throw new CloudUploadError(outcome)
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
