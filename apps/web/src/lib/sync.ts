/**
 * La synchronisation cloud d'un projet, dans les deux sens.
 *
 * Le modèle est celui décidé au plan : le projet est un document auto-contenu,
 * il part et revient d'un bloc, et le conflit se tranche au dernier écrivain
 * sur `updatedAt`. Aucune fusion fine, aucun temps réel — deux navigateurs
 * ouverts en même temps sur le même projet, c'est le dernier qui a écrit qui
 * gagne, et c'est dit tel quel plutôt que déguisé en résolution automatique.
 *
 * Trois règles tiennent le reste :
 *
 * 1. **Rien ne part qui ne soit déjà sur le disque local et consenti.** Les
 *    projets antérieurs au login attendent le geste explicite de rattachement;
 *    après le login, `onProjectCommitted` déclenche la sync à la sortie de la
 *    transaction IndexedDB, pas depuis un abonnement au store.
 * 2. **Rien n'est jamais bloquant.** Une panne de réseau, une session expirée
 *    ou un déploiement injoignable changent une pastille et rien d'autre :
 *    l'édition continue, l'autosave local aussi.
 * 3. **Sans compte ni droit `cloud`, ce module ne s'exécute pas.** `initSync`
 *    sort immédiatement quand l'instance n'est pas configurée, et n'importe
 *    alors rien du SDK.
 */
import { collectAssetIds } from '@/lib/asset-refs'
import { resolveAsset } from '@/lib/assets'
import {
  clearRemoteCloudData,
  downloadRemoteAsset,
  fetchRemoteProject,
  fetchRemoteUserSettings,
  listRemoteProjects,
  pushRemoteProject,
  pushRemoteUserSettings,
  uploadRemoteAsset,
  CloudUploadError,
  type RemoteProject,
} from '@/lib/cloud'
import { cloudConfigured } from '@/lib/convex'
import { projectWithoutThumbnails } from '@/lib/project-file'
import {
  normalizeProject,
  adoptRemoteProject,
  listProjects,
  loadProject,
  onProjectCommitted,
  storeRemoteProject,
  saveCurrentProject,
} from '@/lib/storage'
import {
  clearSyncRecords,
  ensureSyncRecord,
  listSyncRecords,
  readSyncRecord,
  syncKey,
  writeSyncRecord,
  type SyncRecord,
} from '@/lib/sync-queue'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import { toast } from '@/stores/toast.store'
import { useUIStore, type SyncStatus } from '@/stores/ui.store'
import {
  installUserSettings,
  newerSettings,
  onUserSettingsCommitted,
  readUserSettings,
  type UserSettings,
} from '@/lib/user-settings'
import type { Project } from '@/types'
import { CLOUD_OFFER, MEBIBYTE } from '@screenforge/project-format'

const PROJECT_DOWNLOAD_CONCURRENCY = 2
const ASSET_UPLOAD_CONCURRENCY = 4
const ASSET_DOWNLOAD_CONCURRENCY = 4

function setStatus(status: SyncStatus): void {
  useUIStore.getState().setSyncStatus(status)
}

/**
 * Le point unique où la vente se branche.
 *
 * Une instance, une session, et le droit `cloud` — dans cet ordre. Un compte
 * Local n'est pas un compte cloud en erreur : sans le droit,
 * aucune requête ne part et aucun `syncStatus` ne s'affiche. Le déploiement
 * refuserait l'écriture de toute façon (`requireCloud` est le mur), mais lui
 * laisser dire non produirait une pastille rouge et un toast d'échec pour une
 * fonction que l'utilisateur n'a simplement pas achetée.
 *
 * `entitlements` à `null` — droits pas encore lus, ou pas d'instance — vaut
 * non : on ne tente rien tant qu'on ne sait pas. L'abonnement au store rallume
 * la sync dès que la réponse arrive.
 */
function syncAllowed(state = useAuthStore.getState()): boolean {
  return (
    cloudConfigured &&
    state.status === 'signed-in' &&
    state.entitlementsVerified &&
    state.entitlements?.cloud === true
  )
}

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}

function stillSyncing(userId: string): boolean {
  return syncAllowed() && currentUserId() === userId
}

function applySettings(userId: string, settings: UserSettings): void {
  if (!stillSyncing(userId)) return
  installUserSettings(userId, settings)
  useUIStore.getState().setThemeFromSync(settings.theme)
}

async function syncUserSettings(userId: string): Promise<number> {
  const local = readUserSettings(userId)
  const remote = await fetchRemoteUserSettings()
  if (!stillSyncing(userId)) return local.updatedAt

  const winner = newerSettings(local, remote)
  if (winner === remote) {
    applySettings(userId, winner)
    return winner.updatedAt
  }

  if (await pushRemoteUserSettings(local)) {
    applySettings(userId, local)
    return local.updatedAt
  }
  if (!stillSyncing(userId)) return local.updatedAt

  const latest = await fetchRemoteUserSettings()
  if (!latest) throw new Error('Cloud rejected settings without returning its version.')
  const canonical = newerSettings(local, latest)
  applySettings(userId, canonical)
  return canonical.updatedAt
}

/** Runs a bounded queue and never returns while a rejected worker is still active. */
export async function mapBounded<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let next = 0
  const worker = async () => {
    while (next < values.length) {
      const index = next
      next += 1
      results[index] = await mapper(values[index]!)
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  const settled = await Promise.allSettled(workers)
  const failed = settled.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )
  if (failed) throw failed.reason
  return results
}

/** Settle every item with bounded concurrency, preserving partial successes. */
export function mapBoundedSettled<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  return mapBounded(values, concurrency, async (value) => {
    try {
      return { status: 'fulfilled', value: await mapper(value) } as const
    } catch (reason) {
      return { status: 'rejected', reason } as const
    }
  })
}

// ─── Binaires ────────────────────────────────────────────────────────────────

/**
 * Le registre garde des data URL, Storage veut des octets. `fetch` sait lire
 * une `data:` URL et rend le blob décodé avec son type — refaire le décodage
 * base64 à la main ici serait la troisième copie du même code dans le dépôt.
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the asset.'))
    reader.readAsDataURL(blob)
  })
}

// ─── Push ────────────────────────────────────────────────────────────────────

async function pushProject(userId: string, project: Project): Promise<boolean> {
  const key = syncKey(userId, project.id)
  const record = await readSyncRecord(key)
  if (project.updatedAt <= record.pushedUpdatedAt) return true

  const assetIds = [...collectAssetIds(project)]
  const confirmed = new Set(record.uploadedAssetIds.filter((id) => assetIds.includes(id)))
  const missing = assetIds.filter((id) => !confirmed.has(id))

  /* `allSettled` et non `all` : un envoi qui casse au milieu doit laisser
     derrière lui les accusés de réception de ceux qui sont passés, sinon une
     coupure sur la dixième image fait recommencer les neuf premières à chaque
     tentative. */
  const uploads = await mapBoundedSettled(missing, ASSET_UPLOAD_CONCURRENCY, async (id) => {
    const dataUrl = resolveAsset(id)
    if (!dataUrl) throw new Error(`Missing local asset ${id}.`)
    await uploadRemoteAsset(id, await dataUrlToBlob(dataUrl))
    return id
  })
  for (const upload of uploads) {
    if (upload.status === 'fulfilled') confirmed.add(upload.value)
  }

  const failed = uploads.find((upload) => upload.status === 'rejected')
  if (failed) {
    await writeSyncRecord({ ...record, uploadedAssetIds: [...confirmed] })
    throw failed.reason
  }

  /* La ligne part après ses images : l'inverse laisserait une fenêtre où un
     second navigateur tire un projet dont les binaires ne sont pas encore là.
     Le JSON du projet part juste avant sa ligne, pour la même raison. */
  const written = await pushRemoteProject(project, projectWithoutThumbnails(project))

  if (!written) {
    await writeSyncRecord({ ...record, uploadedAssetIds: [...confirmed] })
    return false
  }

  await writeSyncRecord({
    key,
    pushedUpdatedAt: project.updatedAt,
    uploadedAssetIds: [...confirmed],
  })
  return true
}

// ─── Pull ────────────────────────────────────────────────────────────────────

/**
 * Décide s'il y a quelque chose à tirer, et quoi.
 *
 * Deux cas seulement, et le second est celui qui fait la valeur de la fonction.
 *
 * - Le projet ouvert a une ligne distante : on compare les `updatedAt`.
 * - Il n'en a pas, **et il n'a jamais été modifié** (`createdAt === updatedAt`,
 *   la signature d'un « Projet sans titre » que l'application vient de créer
 *   faute d'en trouver un en base) : on adopte le projet distant le plus récent.
 *   C'est le second navigateur, et c'est le seul endroit où l'on remplace un
 *   document par un autre sans que l'utilisateur l'ait demandé — d'où la
 *   condition stricte plutôt qu'une heuristique de fraîcheur.
 */
function pullTarget(rows: RemoteProject[], local: Project | null): string | null {
  if (!rows.length) return null
  const mine = local ? rows.find((row) => row.projectId === local.id) : undefined
  if (mine) return mine.updatedAt > (local?.updatedAt ?? 0) ? mine.projectId : null
  if (local && local.createdAt !== local.updatedAt) return null
  return rows[0].projectId
}

async function downloadAssets(project: Project): Promise<{ id: string; dataUrl: string }[]> {
  return mapBounded([...collectAssetIds(project)], ASSET_DOWNLOAD_CONCURRENCY, async (id) => ({
    id,
    dataUrl: await blobToDataUrl(await downloadRemoteAsset(id)),
  }))
}

interface PullProjectsResult {
  adopted: boolean
  failedProjectIds: string[]
  preservedProject: Project | null
}

interface ProjectBundle {
  project: Project
  assets: { id: string; dataUrl: string }[]
  remoteUpdatedAt: number
}

/**
 * Le catalogue distant, sans le contenu, dans un ordre stable.
 *
 * L'ancienne lecture demandait `select('id, data, updated_at')` par pages de
 * 500 : elle descendait l'intégralité des projets pour comparer des dates. Le
 * JSON vit désormais à côté de la ligne, donc cette liste est petite, tient en
 * une requête, et seuls les projets réellement plus récents sont téléchargés.
 * L'ordre est refait ici parce qu'il porte une décision — `pullTarget` adopte
 * `rows[0]` — et qu'un index Convex ne trie pas sur deux champs quelconques.
 */
export async function fetchRemoteProjectRows(): Promise<RemoteProject[]> {
  const rows = await listRemoteProjects()
  return rows.sort(
    (left, right) =>
      right.updatedAt - left.updatedAt || left.projectId.localeCompare(right.projectId),
  )
}

async function remoteTargetUnchanged(bundle: ProjectBundle): Promise<boolean> {
  const rows = await listRemoteProjects()
  const current = rows.find((row) => row.projectId === bundle.project.id)
  return (current?.updatedAt ?? Number.NaN) === bundle.remoteUpdatedAt
}

async function pullProjects(userId: string): Promise<PullProjectsResult> {
  const initialActive = useProjectStore.getState().project
  const initialActiveId = initialActive?.id ?? null
  const remote = await fetchRemoteProjectRows()
  const targetId = pullTarget(remote, initialActive)
  const local = new Map((await listProjects()).map((project) => [project.id, project]))
  const failedProjectIds = new Set<string>()
  const stale = remote.filter((row) => row.updatedAt > (local.get(row.projectId)?.updatedAt ?? 0))

  /* Le JSON n'est plus dans la ligne : il se télécharge, donc il se télécharge
     avec la même borne de parallélisme que les binaires qui l'accompagnent. */
  const fresh: { project: Project; remoteUpdatedAt: number }[] = []
  await mapBounded(stale, PROJECT_DOWNLOAD_CONCURRENCY, async (row) => {
    try {
      const payload = await fetchRemoteProject(row.projectId)
      /* Disparu entre la liste et le tirage : un autre navigateur l'a supprimé,
         et il n'y a rien à signaler. */
      if (payload === null) return
      const project = normalizeProject(payload)
      if (project.id !== row.projectId) {
        throw new Error('Remote project id does not match its row.')
      }
      fresh.push({ project, remoteUpdatedAt: row.updatedAt })
    } catch (projectError) {
      failedProjectIds.add(row.projectId)
      console.error(`Could not normalize remote project ${row.projectId}.`, projectError)
    }
  })

  let targetBundle: ProjectBundle | null = null
  let preservedProject: Project | null = null
  await mapBounded(fresh, PROJECT_DOWNLOAD_CONCURRENCY, async (candidate) => {
    const { project, remoteUpdatedAt } = candidate
    try {
      const bundle = {
        project,
        assets: await downloadAssets(project),
        remoteUpdatedAt,
      }
      if (!syncAllowed() || currentUserId() !== userId) return
      if (project.id === targetId) {
        targetBundle = bundle
        return
      }

      /* Each complete non-target bundle is committed by its own bounded worker.
         Only the target bundle stays in memory until all workers finish. */
      if (await storeRemoteProject(bundle.project, bundle.assets)) {
        await acknowledgePulledProject(userId, bundle.project, bundle.assets)
      } else {
        const active = useProjectStore.getState().project
        if (active?.id === project.id) preservedProject = active
      }
    } catch (projectError) {
      failedProjectIds.add(project.id)
      console.error(`Could not install remote project ${project.id}.`, projectError)
    }
  })
  if (!syncAllowed() || currentUserId() !== userId) {
    return { adopted: false, failedProjectIds: [], preservedProject: null }
  }

  let adopted = false
  /* TypeScript does not follow assignments made inside the async worker closure. */
  const target = targetBundle as ProjectBundle | null
  if (target) {
    try {
      if (!(await remoteTargetUnchanged(target))) {
        failedProjectIds.add(target.project.id)
      } else {
        const currentActiveId = useProjectStore.getState().project?.id ?? null
        if (currentActiveId !== initialActiveId) {
          /* Navigation is a user decision, independent from LWW. The target can
             join the local catalogue, but a download finishing late must never
             reopen the project that was active when the pull started. */
          if (await storeRemoteProject(target.project, target.assets)) {
            await acknowledgePulledProject(userId, target.project, target.assets)
          }
          preservedProject = useProjectStore.getState().project
        } else {
          const result = await adoptRemoteProject(target.project, target.assets)
          if (result.stored) {
            await acknowledgePulledProject(userId, target.project, target.assets)
          }
          if (result.activated) {
            ignoredAdoptionCommit = {
              id: target.project.id,
              updatedAt: target.project.updatedAt,
            }
            adopted = true
          } else {
            preservedProject = useProjectStore.getState().project
          }
        }
      }
    } catch (projectError) {
      failedProjectIds.add(target.project.id)
      console.error(`Could not open remote project ${target.project.id}.`, projectError)
    }
  }
  return { adopted, failedProjectIds: [...failedProjectIds], preservedProject }
}

async function acknowledgePulledProject(
  userId: string,
  project: Project,
  assets: readonly { id: string }[],
): Promise<void> {
  await writeSyncRecord({
    key: syncKey(userId, project.id),
    pushedUpdatedAt: project.updatedAt,
    uploadedAssetIds: assets.map((asset) => asset.id),
  })
  releaseConsent(userId, project.id)
}

function reportPullFailures(projectIds: readonly string[]): void {
  console.error(`Remote project catalogue incomplete: ${projectIds.join(', ')}.`)
  const plural = projectIds.length > 1 ? 's' : ''
  const verb = projectIds.length > 1 ? 'n’ont' : 'n’a'
  toast(
    `${projectIds.length} projet${plural} cloud ${verb} pas pu être récupéré${plural}. Les autres restent disponibles.`,
    'error',
    { action: { label: 'Réessayer', onClick: schedule } },
  )
}

// ─── Disponibilité des projets locaux ────────────────────────────────────────

export const PROJECT_AVAILABILITY_LABELS = {
  'device-only': 'Cet appareil',
  cloud: 'Cloud',
  pending: 'À synchroniser',
} as const

export type ProjectAvailability = keyof typeof PROJECT_AVAILABILITY_LABELS

export interface ProjectCatalogueEntry {
  id: string
  name: string
  updatedAt: number
  availability: ProjectAvailability
}

type ProjectMetadata = Pick<Project, 'id' | 'name' | 'updatedAt'>

export interface ConsentBarrier {
  userId: string | null
  ready: boolean
  projectIds: ReadonlySet<string>
}

/** Projects already carrying local work when this account's Cloud session opened. */
export function consentRequiredProjectIds(
  projects: readonly Pick<Project, 'id' | 'createdAt' | 'updatedAt'>[],
  userId: string,
  records: readonly Pick<SyncRecord, 'key'>[],
): Set<string> {
  const attached = new Set(records.map((record) => record.key))
  return new Set(
    projects.flatMap((project) =>
      touched(project) && !attached.has(syncKey(userId, project.id)) ? [project.id] : [],
    ),
  )
}

/** Fail closed until the active account's local catalogue has been classified. */
export function canCreateSyncRecord(
  barrier: ConsentBarrier,
  userId: string,
  projectId: string,
): boolean {
  return barrier.ready && barrier.userId === userId && !barrier.projectIds.has(projectId)
}

/**
 * Vue pure du catalogue : elle décrit où une copie est disponible, jamais ce
 * que le compte a le droit d'écrire. Tout projet reste local; un record absent
 * signifie donc « cet appareil », pas « Cloud refusé ».
 */
export function projectAvailabilityCatalogue(
  projects: readonly ProjectMetadata[],
  userId: string | null,
  records: readonly Pick<SyncRecord, 'key' | 'pushedUpdatedAt'>[],
): ProjectCatalogueEntry[] {
  const recordsByKey = new Map(records.map((record) => [record.key, record]))
  return projects
    .map((project) => {
      const record = userId ? recordsByKey.get(syncKey(userId, project.id)) : undefined
      const availability: ProjectAvailability = !record
        ? 'device-only'
        : project.updatedAt > record.pushedUpdatedAt
          ? 'pending'
          : 'cloud'
      return { ...project, availability }
    })
    .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
}

/** Catalogue local et accusés durables uniquement — aucun appel réseau, aucun write. */
export async function listProjectCatalogue(): Promise<ProjectCatalogueEntry[]> {
  const auth = useAuthStore.getState()
  const userId = syncAllowed(auth) ? (auth.user?.id ?? null) : null
  if (!userId) return projectAvailabilityCatalogue(await listProjects(), null, [])

  const [projects, records] = await Promise.all([listProjects(), listSyncRecords(userId)])
  return projectAvailabilityCatalogue(projects, userId, records)
}

// ─── Rattachement des projets locaux ─────────────────────────────────────────

export interface LocalProject {
  id: string
  name: string
  updatedAt: number
}

/**
 * Les projets de ce navigateur que le compte courant n'a jamais envoyés.
 *
 * Aucun projet antérieur au login, y compris celui qui est ouvert, ne doit
 * quitter le navigateur sans consentement. Une fois rattaché, son accusé local
 * permet au cycle ordinaire de reprendre les envois interrompus. Les commits
 * effectués après le login créent eux-mêmes cet accusé via `onProjectCommitted`.
 *
 * « Jamais envoyé » se lit dans la file de synchronisation, pas dans la base
 * distante : `pushedUpdatedAt` à zéro pour cette paire compte/projet. Interroger
 * le serveur donnerait la même réponse au prix d'un aller-retour, et se
 * tromperait sur un projet poussé depuis un autre navigateur — qui n'a alors
 * rien à rattacher ici non plus.
 */
export async function unattachedProjects(): Promise<LocalProject[]> {
  const userId = currentUserId()
  if (!userId || !syncAllowed()) return []
  await ensureConsentBarrier(userId)
  if (!stillSyncing(userId) || !consentBarrier.ready) return []
  const local = await listProjects()
  return local.flatMap((project) =>
    consentBarrier.projectIds.has(project.id) && touched(project)
      ? [{ id: project.id, name: project.name, updatedAt: project.updatedAt }]
      : [],
  )
}

/**
 * A été ouvert par quelqu'un, pas seulement créé par l'application.
 *
 * `createdAt === updatedAt` est la signature du « Projet sans titre » que
 * l'éditeur ouvre au démarrage faute d'en trouver un en base — la même que
 * `pullTarget` utilise pour décider qu'il peut le remplacer. Sans ce filtre, un
 * premier login proposerait de rattacher le document vide que l'application
 * venait elle-même de fabriquer, et il le proposerait à chaque session.
 */
function touched(project: { createdAt: number; updatedAt: number }): boolean {
  return project.createdAt !== project.updatedAt
}

/**
 * Envoie les projets demandés, et rend ceux qui ont échoué.
 *
 * Dans la file plutôt qu'à côté : deux `upsert` concurrents sur la même ligne
 * peuvent arriver dans le désordre, et le projet ouvert est presque toujours
 * dans la liste à rattacher. Un échec par projet ne fait pas tomber les autres —
 * une seule image manquante ne doit pas retenir quatre projets sains.
 */
export async function attachProjects(ids: string[]): Promise<string[]> {
  const failed: string[] = []
  const run = async () => {
    const userId = currentUserId()
    if (!userId || !syncAllowed()) {
      failed.push(...ids)
      return
    }
    setStatus('syncing')
    const activeProjectId = useProjectStore.getState().project?.id
    try {
      for (const id of ids) {
        try {
          const project = await loadProject(id)
          if (!project || !(await pushProject(userId, project))) {
            failed.push(id)
          } else {
            releaseConsent(userId, id)
            queued.delete(id)
          }
        } catch (error) {
          console.error('Could not attach a local project.', error)
          failed.push(id)
        }
      }
    } finally {
      /* `loadProject` remplace le registre binaire. Le restaurer est obligatoire
         même si un rattachement échoue : l'éditeur reste sur le projet actif. */
      if (activeProjectId) await loadProject(activeProjectId)
    }
    setStatus(failed.length === ids.length ? 'error' : 'synced')
  }

  chain = chain.then(run)
  await chain
  return failed
}

export type ClearCloudCopyOutcome = 'cleared' | 'incomplete' | 'unknown'

/** Clear the remote mirror while preserving local projects and requiring fresh consent. */
export async function clearCloudCopy(): Promise<ClearCloudCopyOutcome> {
  await saveCurrentProject()
  let outcome: ClearCloudCopyOutcome = 'unknown'
  const run = async () => {
    const userId = currentUserId()
    if (!userId) {
      outcome = 'unknown'
      return
    }
    setStatus('syncing')
    try {
      const remote = await clearRemoteCloudData()
      if (remote !== 'cleared') {
        outcome = 'incomplete'
        setStatus('error')
        return
      }
      await clearSyncRecords(userId)
      queued.clear()
      resetConsentBarrier(userId)
      await ensureConsentBarrier(userId)
      pulled = true
      settingsPulled = true
      settingsDirty = false
      ignoredAdoptionCommit = null
      setStatus('synced')
      outcome = 'cleared'
    } catch (error) {
      console.error('Could not clear the Cloud copy.', error)
      setStatus('error')
      outcome = 'unknown'
    }
  }
  chain = chain.then(run)
  await chain
  return outcome
}

interface PendingPushResult {
  pushedProjectIds: string[]
  remoteRejected: boolean
}

/** Rebuild the durable queue from local metadata and per-user acknowledgements. */
async function pushPendingProjects(userId: string): Promise<PendingPushResult> {
  const [local, records] = await Promise.all([listProjects(), listSyncRecords(userId)])
  const acknowledged = new Map(records.map((record) => [record.key, record.pushedUpdatedAt]))
  const pending = local
    .filter((project) => {
      const pushedUpdatedAt = acknowledged.get(syncKey(userId, project.id))
      return pushedUpdatedAt !== undefined && project.updatedAt > pushedUpdatedAt
    })
    .sort((left, right) => left.updatedAt - right.updatedAt || left.id.localeCompare(right.id))

  const pushedProjectIds: string[] = []
  let remoteRejected = false
  let registryChanged = false
  try {
    for (const metadata of pending) {
      if (!syncAllowed() || currentUserId() !== userId) break
      /* This read hydrates the binary registry but is not a user commit. If it
         notified the sync listener, every failed push would schedule itself
         again immediately instead of remaining durably pending for retry. */
      const project = await loadProject(metadata.id, { notifyCommit: false })
      registryChanged = true
      if (!project) continue
      if (await pushProject(userId, project)) pushedProjectIds.push(project.id)
      else remoteRejected = true
    }
  } finally {
    /* Loading a project also loads its assets. Always put the current editor's
       registry back, even after a partial upload or a rejected remote write. */
    const activeProjectId = useProjectStore.getState().project?.id
    if (registryChanged && activeProjectId) {
      await loadProject(activeProjectId, { notifyCommit: false })
    }
  }
  return { pushedProjectIds, remoteRejected }
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/** La file d'exécution : un cycle à la fois — voir `schedule`. */
let chain: Promise<void> = Promise.resolve()
/** In-session coalescing only; IndexedDB metadata + acknowledgements are authoritative. */
const queued = new Map<string, Project>()
/** Account-scoped privacy barrier rebuilt before any project can join the durable queue. */
let consentBarrier: ConsentBarrier = { userId: null, ready: false, projectIds: new Set() }
let consentBarrierLoad: Promise<void> | null = null
let consentBarrierGeneration = 0
/** The one autosave commit produced by a remote adoption, and no other commit. */
let ignoredAdoptionCommit: Pick<Project, 'id' | 'updatedAt'> | null = null
/** Le tirage n'a lieu qu'une fois par session ouverte, à l'ouverture. */
let pulled = false
/** Les préférences se tirent à l'ouverture, puis seulement après un changement local. */
let settingsPulled = false
let settingsDirty = false

function resetConsentBarrier(userId: string | null): void {
  consentBarrierGeneration += 1
  consentBarrier = { userId, ready: false, projectIds: new Set() }
  consentBarrierLoad = null
}

async function ensureConsentBarrier(userId: string): Promise<void> {
  if (consentBarrier.userId !== userId) resetConsentBarrier(userId)
  if (consentBarrier.ready) return
  if (!consentBarrierLoad) {
    const generation = consentBarrierGeneration
    const load = Promise.all([listProjects(), listSyncRecords(userId)]).then(
      ([projects, records]) => {
        if (
          generation !== consentBarrierGeneration ||
          consentBarrier.userId !== userId ||
          !stillSyncing(userId)
        ) {
          return
        }
        consentBarrier = {
          userId,
          ready: true,
          projectIds: consentRequiredProjectIds(projects, userId, records),
        }
      },
    )
    consentBarrierLoad = load
    try {
      await load
    } finally {
      if (consentBarrierLoad === load) consentBarrierLoad = null
    }
    return
  }
  await consentBarrierLoad
}

function releaseConsent(userId: string, projectId: string): void {
  if (consentBarrier.userId !== userId || !consentBarrier.projectIds.has(projectId)) return
  const projectIds = new Set(consentBarrier.projectIds)
  projectIds.delete(projectId)
  consentBarrier = { ...consentBarrier, projectIds }
}

function preserveProject(project: Project | null): void {
  if (!project) return
  const current = queued.get(project.id)
  if (!current || current.updatedAt < project.updatedAt) queued.set(project.id, project)
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

async function cycle(): Promise<void> {
  if (!syncAllowed()) return setStatus('off')
  const userId = currentUserId()
  if (!userId) return setStatus('off')
  await ensureConsentBarrier(userId)
  if (!stillSyncing(userId)) return setStatus('off')
  if (offline()) return setStatus('offline')

  setStatus('syncing')
  let pullIncomplete = false

  const shouldPullProjects = !pulled
  const shouldSyncSettings = !settingsPulled || settingsDirty
  const [projectsResult, settingsResult] = await Promise.allSettled([
    shouldPullProjects ? pullProjects(userId) : Promise.resolve(null),
    shouldSyncSettings ? syncUserSettings(userId) : Promise.resolve(null),
  ])

  if (!stillSyncing(userId)) return setStatus('off')

  if (projectsResult.status === 'fulfilled' && projectsResult.value) {
    const result = projectsResult.value
    preserveProject(result.preservedProject)
    if (result.adopted) toast('Version cloud chargée.', 'info')
    if (result.failedProjectIds.length > 0) {
      pullIncomplete = true
      reportPullFailures(result.failedProjectIds)
    }
    pulled = !pullIncomplete
  }
  if (settingsResult.status === 'fulfilled' && settingsResult.value !== null) {
    settingsDirty = readUserSettings(userId).updatedAt > settingsResult.value
    settingsPulled = !settingsDirty
  }
  if (projectsResult.status === 'rejected') throw projectsResult.reason
  if (settingsResult.status === 'rejected') throw settingsResult.reason

  if (!stillSyncing(userId)) return setStatus('off')
  /* Ne jamais enrôler implicitement le projet ouvert ici. Au premier login il
     peut avoir été créé bien avant la session Cloud et doit rester local tant
     que « Ajouter les N projets au Cloud » n'a pas été choisi. Les projets déjà rattachés ont
     un record durable; les commits post-login entrent dans `queued`. */
  const barrier = consentBarrier
  await Promise.all(
    [...queued.values()]
      .filter((project) => canCreateSyncRecord(barrier, userId, project.id))
      .map((project) => ensureSyncRecord(syncKey(userId, project.id))),
  )
  const pushed = await pushPendingProjects(userId)
  for (const projectId of pushed.pushedProjectIds) queued.delete(projectId)
  if (pushed.remoteRejected) {
    const result = await pullProjects(userId)
    preserveProject(result.preservedProject)
    if (result.adopted) toast('Version cloud plus récente chargée.', 'info')
    if (result.failedProjectIds.length > 0) {
      pullIncomplete = true
      reportPullFailures(result.failedProjectIds)
    }
  }
  if (!stillSyncing(userId)) return setStatus('off')
  setStatus(pullIncomplete ? 'error' : 'synced')
}

function fail(error: unknown): void {
  if (!syncAllowed()) return setStatus('off')
  console.error('Cloud sync failed.', error)
  if (offline()) return setStatus('offline')
  setStatus('error')
  const quota = error instanceof CloudUploadError ? cloudQuotaMessage(error.outcome) : undefined
  toast(
    quota ?? 'Synchronisation impossible. Vos modifications restent enregistrées ici.',
    'error',
    {
      action: quota
        ? {
            label: 'Gérer les données',
            onClick: () => useUIStore.getState().setShowAccountDialog(true),
          }
        : { label: 'Réessayer', onClick: schedule },
    },
  )
}

const CLOUD_QUOTA_MESSAGES: Readonly<Record<string, string>> = {
  'project-count-limit': `Limite Cloud atteinte : ${CLOUD_OFFER.limits.projects} projets. Effacez la copie Cloud avant de réessayer.`,
  'project-storage-limit': `Limite Cloud atteinte : ${CLOUD_OFFER.limits.projectBytes / MEBIBYTE} Mio de projets. Effacez la copie Cloud avant de réessayer.`,
  'asset-count-limit': `Limite Cloud atteinte : ${CLOUD_OFFER.limits.assets} images. Effacez la copie Cloud avant de réessayer.`,
  'asset-storage-limit': `Limite Cloud atteinte : ${CLOUD_OFFER.limits.assetBytes / MEBIBYTE} Mio d’images. Effacez la copie Cloud avant de réessayer.`,
  'file-too-large': 'Ce fichier dépasse la limite Cloud. Réduisez-le avant de réessayer.',
}

export function cloudQuotaMessage(outcome: string): string | undefined {
  return CLOUD_QUOTA_MESSAGES[outcome]
}

/**
 * Un cycle à la fois, en file.
 *
 * Deux `upsert` concurrents sur la même ligne peuvent arriver dans le désordre
 * et laisser le serveur sur la version la plus ancienne. La chaîne l'interdit,
 * et l'autosave qui la nourrit ne commite au plus qu'une fois toutes les deux
 * secondes — il n'y a donc pas de second minuteur à écrire pour borner le débit.
 */
function schedule(): void {
  if (!syncAllowed()) return setStatus('off')
  chain = chain.then(cycle).catch(fail)
}

/**
 * Branche la sync, et rend son démonteur.
 *
 * Sans instance configurée, rien ne s'abonne et le SDK n'est pas chargé : la
 * couche cloud est additive, elle ne doit pas peser sur ce à quoi elle
 * n'ajoute rien.
 */
export function initSync(): () => void {
  if (!cloudConfigured) return () => {}

  const queueProject = (project: Project) => {
    const userId = currentUserId()
    if (!userId || !syncAllowed()) return
    preserveProject(project)
    schedule()
  }

  const stopCommits = onProjectCommitted((project) => {
    if (!syncAllowed()) return
    if (
      ignoredAdoptionCommit?.id === project.id &&
      ignoredAdoptionCommit.updatedAt === project.updatedAt
    ) {
      ignoredAdoptionCommit = null
      return
    }
    if (ignoredAdoptionCommit?.id === project.id) ignoredAdoptionCommit = null
    queueProject(project)
  })

  /* On suit le droit, pas le statut : les droits arrivent une requête après la
     session, donc au moment où `signed-in` est posé la réponse est encore
     `null`. Guetter le seul changement de statut laisserait la sync éteinte
     jusqu'à la modification suivante — et un achat du Cloud en cours de session
     ne l'allumerait jamais. */
  let allowed = syncAllowed()
  let activeUserId = allowed ? currentUserId() : null
  resetConsentBarrier(activeUserId)
  const stopAuth = useAuthStore.subscribe((state) => {
    const next = syncAllowed(state)
    const nextUserId = next ? (state.user?.id ?? null) : null
    if (next === allowed && nextUserId === activeUserId) return
    const accountChanged = nextUserId !== activeUserId
    allowed = next
    activeUserId = nextUserId
    if (accountChanged) {
      resetConsentBarrier(nextUserId)
      pulled = false
      settingsPulled = false
      settingsDirty = false
      queued.clear()
      ignoredAdoptionCommit = null
    }
    if (next) {
      /* Un droit qui s'ouvre repart d'un tirage : c'est le moment exact où
         « ouvrir l'app connecté » et « se connecter » deviennent le même geste. */
      pulled = false
      schedule()
      return
    }
    pulled = false
    settingsPulled = false
    settingsDirty = false
    queued.clear()
    ignoredAdoptionCommit = null
    resetConsentBarrier(null)
    setStatus('off')
  })

  const stopSettings = onUserSettingsCommitted((userId) => {
    if (!userId || userId !== currentUserId() || !syncAllowed()) return
    settingsDirty = true
    schedule()
  })

  const refreshRemote = () => {
    if (document.hidden || !syncAllowed()) return
    pulled = false
    settingsPulled = false
    schedule()
  }
  const onOnline = () => refreshRemote()
  const onOffline = () => {
    if (syncAllowed()) setStatus('offline')
  }
  window.addEventListener('focus', refreshRemote)
  document.addEventListener('visibilitychange', refreshRemote)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  /* Le cas « la session était déjà restaurée avant cet abonnement » : sans ce
     coup d'envoi, un rechargement de page connecté ne tirerait jamais. */
  if (syncAllowed()) schedule()
  const stopPrompt = promptForUnattachedProjects()

  return () => {
    stopCommits()
    stopAuth()
    stopSettings()
    stopPrompt()
    window.removeEventListener('focus', refreshRemote)
    document.removeEventListener('visibilitychange', refreshRemote)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    resetConsentBarrier(null)
  }
}

/**
 * Propose le rattachement quand une session cloud trouve des projets orphelins.
 *
 * Le premier tirage passe avant : il peut installer un projet distant, et
 * demander de rattacher pendant qu'on télécharge afficherait une liste qui
 * change sous les yeux. On attend donc que le premier cycle soit retombé sur
 * `synced`.
 *
 * Une seule fois par session ouverte : la boîte reparaît au login suivant, pas
 * à chaque reconnexion réseau.
 */
function promptForUnattachedProjects(): () => void {
  let askedForUserId: string | null = null

  const consider = () => {
    const userId = currentUserId()
    if (!userId || askedForUserId === userId || useUIStore.getState().syncStatus !== 'synced') {
      return
    }
    askedForUserId = userId
    void unattachedProjects()
      .then((projects) => {
        if (projects.length > 0) useUIStore.getState().setShowMigrateDialog(true)
      })
      .catch((error: unknown) => {
        if (askedForUserId === userId) askedForUserId = null
        console.error('Could not inspect local projects to attach.', error)
      })
  }

  consider()
  return useUIStore.subscribe((state, previous) => {
    if (state.syncStatus === previous.syncStatus) return
    /* Une déconnexion réarme : le compte suivant a ses propres orphelins. */
    if (state.syncStatus === 'off') askedForUserId = null
    else consider()
  })
}
