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
 * 1. **Rien ne part qui ne soit déjà sur le disque local.** Le déclencheur est
 *    `onProjectCommitted`, à la sortie de la transaction IndexedDB, pas un
 *    abonnement au store.
 * 2. **Rien n'est jamais bloquant.** Une panne de réseau, une session expirée
 *    ou un bucket indisponible changent une pastille et rien d'autre : l'édition
 *    continue, l'autosave local aussi.
 * 3. **Sans compte ni droit `cloud`, ce module ne s'exécute pas.** `initSync`
 *    sort immédiatement quand l'instance n'est pas configurée, et n'importe
 *    alors rien du SDK.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { collectAssetIds } from '@/lib/asset-refs'
import { resolveAsset } from '@/lib/assets'
import { rightsOf } from '@/lib/entitlements'
import { projectWithoutThumbnails } from '@/lib/project-file'
import {
  normalizeProject,
  adoptRemoteProject,
  listProjects,
  loadProject,
  onProjectCommitted,
  storeRemoteProject,
} from '@/lib/storage'
import { cloudConfigured, getSupabase } from '@/lib/supabase'
import {
  ensureSyncRecord,
  listSyncRecords,
  readSyncRecord,
  syncKey,
  writeSyncRecord,
} from '@/lib/sync-queue'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import { toast } from '@/stores/toast.store'
import { useUIStore, type SyncStatus } from '@/stores/ui.store'
import type { Database, Json } from '@/types/database.types'
import type { Project } from '@/types'

const BUCKET = 'assets'
const PROJECT_DOWNLOAD_CONCURRENCY = 2
const PROJECT_PAGE_SIZE = 500
const ASSET_UPLOAD_CONCURRENCY = 4
const ASSET_DOWNLOAD_CONCURRENCY = 4

type Client = SupabaseClient<Database>

function setStatus(status: SyncStatus): void {
  useUIStore.getState().setSyncStatus(status)
}

/**
 * Le point unique où la vente se branche.
 *
 * Une instance, une session, et le droit `cloud` — dans cet ordre. Un compte
 * Licence est un compte local, pas un compte cloud en erreur : sans le droit,
 * aucune requête ne part et aucun `syncStatus` ne s'affiche. La base refuserait
 * l'écriture de toute façon (`public.has_cloud()` garde les policies), mais lui
 * laisser dire non produirait une pastille rouge et un toast d'échec pour une
 * fonction que l'utilisateur n'a simplement pas achetée.
 *
 * `entitlements` à `null` — droits pas encore lus, ou pas d'instance — vaut
 * non : on ne tente rien tant qu'on ne sait pas. L'abonnement au store rallume
 * la sync dès que la réponse arrive.
 */
function syncAllowed(state = useAuthStore.getState()): boolean {
  return cloudConfigured && state.status === 'signed-in' && rightsOf(state.entitlements).sync
}

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null
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

async function pushProject(client: Client, userId: string, project: Project): Promise<boolean> {
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
    const blob = await dataUrlToBlob(dataUrl)
    const { error } = await client.storage
      .from(BUCKET)
      .upload(`${userId}/${id}`, blob, { contentType: blob.type, upsert: true })
    if (error) throw error
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
     second navigateur tire un projet dont les binaires ne sont pas encore là. */
  const { data: written, error } = await client.rpc('upsert_project_lww', {
    project_id: project.id,
    project_user_id: userId,
    project_name: project.name,
    project_data: projectWithoutThumbnails(project) as unknown as Json,
    project_updated_at: new Date(project.updatedAt).toISOString(),
  })
  if (error) throw error

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
function pullTarget(
  rows: { id: string; updated_at: string }[],
  local: Project | null,
): string | null {
  if (!rows.length) return null
  const mine = local ? rows.find((row) => row.id === local.id) : undefined
  if (mine) return Date.parse(mine.updated_at) > (local?.updatedAt ?? 0) ? mine.id : null
  if (local && local.createdAt !== local.updatedAt) return null
  return rows[0].id
}

async function downloadAssets(
  client: Client,
  userId: string,
  project: Project,
): Promise<{ id: string; dataUrl: string }[]> {
  return mapBounded([...collectAssetIds(project)], ASSET_DOWNLOAD_CONCURRENCY, async (id) => {
    const { data, error } = await client.storage.from(BUCKET).download(`${userId}/${id}`)
    if (error) throw error
    return { id, dataUrl: await blobToDataUrl(data) }
  })
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

interface RemoteProjectRow {
  id: string
  data: Json
  updated_at: string
}

/** Read every PostgREST page in one stable order without an unbounded request. */
export async function fetchRemoteProjectRows(client: Client): Promise<RemoteProjectRow[]> {
  const rows: RemoteProjectRow[] = []
  for (let from = 0; ; from += PROJECT_PAGE_SIZE) {
    const { data, error } = await client
      .from('projects')
      .select('id, data, updated_at')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PROJECT_PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as RemoteProjectRow[]
    rows.push(...page)
    if (page.length < PROJECT_PAGE_SIZE) return rows
  }
}

async function remoteTargetUnchanged(client: Client, bundle: ProjectBundle): Promise<boolean> {
  const remoteVersion = await client
    .from('projects')
    .select('updated_at')
    .eq('id', bundle.project.id)
    .maybeSingle()
  if (remoteVersion.error) throw remoteVersion.error
  const currentRemoteUpdatedAt = remoteVersion.data
    ? Date.parse(remoteVersion.data.updated_at)
    : Number.NaN
  return currentRemoteUpdatedAt === bundle.remoteUpdatedAt
}

async function pullProjects(client: Client, userId: string): Promise<PullProjectsResult> {
  const initialActive = useProjectStore.getState().project
  const remote = await fetchRemoteProjectRows(client)
  const targetId = pullTarget(remote, initialActive)
  const local = new Map((await listProjects()).map((project) => [project.id, project]))
  const failedProjectIds = new Set<string>()
  const fresh: { project: Project; remoteUpdatedAt: number }[] = []
  for (const row of remote) {
    const remoteUpdatedAt = Date.parse(row.updated_at)
    if (remoteUpdatedAt <= (local.get(row.id)?.updatedAt ?? 0)) continue
    try {
      const project = normalizeProject(row.data)
      if (project.id !== row.id) throw new Error('Remote project id does not match its row.')
      fresh.push({ project, remoteUpdatedAt })
    } catch (projectError) {
      failedProjectIds.add(row.id)
      console.error(`Could not normalize remote project ${row.id}.`, projectError)
    }
  }
  let targetBundle: ProjectBundle | null = null
  let preservedProject: Project | null = null
  await mapBounded(fresh, PROJECT_DOWNLOAD_CONCURRENCY, async (candidate) => {
    const { project, remoteUpdatedAt } = candidate
    try {
      const bundle = {
        project,
        assets: await downloadAssets(client, userId, project),
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
      if (!(await remoteTargetUnchanged(client, target))) {
        failedProjectIds.add(target.project.id)
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
    } catch (projectError) {
      failedProjectIds.add(target.project.id)
      console.error(`Could not open remote project ${target.project.id}.`, projectError)
    }
  }
  return { adopted, failedProjectIds: [...failedProjectIds], preservedProject }
}

function acknowledgePulledProject(
  userId: string,
  project: Project,
  assets: readonly { id: string }[],
): Promise<void> {
  return writeSyncRecord({
    key: syncKey(userId, project.id),
    pushedUpdatedAt: project.updatedAt,
    uploadedAssetIds: assets.map((asset) => asset.id),
  })
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

// ─── Rattachement des projets locaux ─────────────────────────────────────────

export interface LocalProject {
  id: string
  name: string
  updatedAt: number
}

/**
 * Les projets de ce navigateur que le compte courant n'a jamais envoyés.
 *
 * Le cycle ordinaire ne pousse que le projet ouvert : c'est ce qu'il faut pour
 * une session de travail, et c'est insuffisant au premier login. Quelqu'un qui
 * a construit cinq projets avant d'acheter le Cloud n'en verrait remonter qu'un,
 * et rien ne le lui dirait.
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
  const local = await listProjects()
  const records = await Promise.all(
    local.map((project) => readSyncRecord(syncKey(userId, project.id))),
  )
  return local.flatMap((project, index) =>
    records[index].pushedUpdatedAt === 0 && touched(project)
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
    const pending = getSupabase()
    if (!userId || !pending || !syncAllowed()) {
      failed.push(...ids)
      return
    }
    const client = await pending
    setStatus('syncing')
    const activeProjectId = useProjectStore.getState().project?.id
    try {
      for (const id of ids) {
        try {
          const project = await loadProject(id)
          if (!project || !(await pushProject(client, userId, project))) {
            failed.push(id)
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

interface PendingPushResult {
  pushedProjectIds: string[]
  remoteRejected: boolean
}

/** Rebuild the durable queue from local metadata and per-user acknowledgements. */
async function pushPendingProjects(client: Client, userId: string): Promise<PendingPushResult> {
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
      if (await pushProject(client, userId, project)) pushedProjectIds.push(project.id)
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
/** The one autosave commit produced by a remote adoption, and no other commit. */
let ignoredAdoptionCommit: Pick<Project, 'id' | 'updatedAt'> | null = null
/** Le tirage n'a lieu qu'une fois par session ouverte, à l'ouverture. */
let pulled = false

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
  const pending = getSupabase()
  if (!userId || !pending) return setStatus('off')
  if (offline()) return setStatus('offline')

  setStatus('syncing')
  const client = await pending
  let pullIncomplete = false

  if (!pulled) {
    const result = await pullProjects(client, userId)
    preserveProject(result.preservedProject)
    if (result.adopted) toast('Version cloud chargée.', 'info')
    if (result.failedProjectIds.length > 0) {
      pullIncomplete = true
      reportPullFailures(result.failedProjectIds)
    }
    pulled = !pullIncomplete
  }

  if (!syncAllowed() || currentUserId() !== userId) return setStatus('off')
  const activeProject = useProjectStore.getState().project
  if (activeProject) await ensureSyncRecord(syncKey(userId, activeProject.id))
  await Promise.all(
    [...queued.values()].map((project) => ensureSyncRecord(syncKey(userId, project.id))),
  )
  const pushed = await pushPendingProjects(client, userId)
  for (const projectId of pushed.pushedProjectIds) queued.delete(projectId)
  if (pushed.remoteRejected) {
    const result = await pullProjects(client, userId)
    preserveProject(result.preservedProject)
    if (result.adopted) toast('Version cloud plus récente chargée.', 'info')
    if (result.failedProjectIds.length > 0) {
      pullIncomplete = true
      reportPullFailures(result.failedProjectIds)
    }
  }
  if (!syncAllowed() || currentUserId() !== userId) return setStatus('off')
  setStatus(pullIncomplete ? 'error' : 'synced')
}

function fail(error: unknown): void {
  if (!syncAllowed()) return setStatus('off')
  console.error('Cloud sync failed.', error)
  if (offline()) return setStatus('offline')
  setStatus('error')
  toast('Synchronisation impossible. Vos modifications restent enregistrées ici.', 'error', {
    action: { label: 'Réessayer', onClick: schedule },
  })
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
    void ensureSyncRecord(syncKey(userId, project.id))
      .then(() => {
        if (syncAllowed() && currentUserId() === userId) schedule()
      })
      .catch(fail)
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
  const stopAuth = useAuthStore.subscribe((state) => {
    const next = syncAllowed(state)
    if (next === allowed) return
    allowed = next
    if (next) {
      /* Un droit qui s'ouvre repart d'un tirage : c'est le moment exact où
         « ouvrir l'app connecté » et « se connecter » deviennent le même geste. */
      pulled = false
      schedule()
      return
    }
    pulled = false
    queued.clear()
    ignoredAdoptionCommit = null
    setStatus('off')
  })

  const onOnline = () => schedule()
  const onOffline = () => {
    if (syncAllowed()) setStatus('offline')
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  /* Le cas « la session était déjà restaurée avant cet abonnement » : sans ce
     coup d'envoi, un rechargement de page connecté ne tirerait jamais. */
  if (syncAllowed()) schedule()
  const stopPrompt = promptForUnattachedProjects()

  return () => {
    stopCommits()
    stopAuth()
    stopPrompt()
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
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
  let asked = false

  const consider = () => {
    if (asked || useUIStore.getState().syncStatus !== 'synced') return
    asked = true
    void unattachedProjects()
      .then((projects) => {
        if (projects.length > 0) useUIStore.getState().setShowMigrateDialog(true)
      })
      .catch((error: unknown) => {
        asked = false
        console.error('Could not inspect local projects to attach.', error)
      })
  }

  consider()
  return useUIStore.subscribe((state, previous) => {
    if (state.syncStatus === previous.syncStatus) return
    /* Une déconnexion réarme : le compte suivant a ses propres orphelins. */
    if (state.syncStatus === 'off') asked = false
    else consider()
  })
}
