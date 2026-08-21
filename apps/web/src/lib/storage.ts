import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  hydrateAssets,
  markAssetsClean,
  readDirtyAssets,
  registerAsset,
  sweepAssets,
} from '@/lib/assets'
import { collectAssetIds } from '@/lib/asset-refs'
import { readProjectFile, type DecodedProjectFile } from '@/lib/project-file'
import { isProject, migrateProject } from '@/lib/project-validation'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useHistoryStore } from '@/stores/history.store'
import { toast } from '@/stores/toast.store'
import { useUIStore } from '@/stores/ui.store'
import type { Layer, Project, StoreTargetId } from '@/types'

interface AssetRecord {
  id: string
  projectId: string
  dataUrl: string
}

interface ScreenForgeDB extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { 'by-updated': number }
  }
  assets: {
    key: string
    value: AssetRecord
    indexes: { 'by-project': string }
  }
  /**
   * Les gabarits enregistrés, qui n'appartiennent à aucun projet.
   *
   * Ils vivent ici plutôt que dans le projet parce que c'est leur seule raison
   * d'être : une mise en page trouvée dans un projet doit servir au suivant.
   * Le contenu est décrit par `lib/custom-templates.ts`, qui les valide en les
   * relisant — le magasin ne fait que les garder.
   */
  templates: {
    key: string
    value: unknown
  }
}

let dbPromise: Promise<IDBPDatabase<ScreenForgeDB>> | null = null

type CommitListener = (project: Project) => void
const commitListeners = new Set<CommitListener>()

/**
 * Le seul entonnoir par lequel la sync cloud apprend qu'il y a du neuf.
 *
 * Elle pourrait s'abonner au store comme l'autosave le fait, mais elle
 * pousserait alors un état que le disque local n'a pas encore accepté : en cas
 * d'échec de la transaction IndexedDB, le cloud porterait une version que ce
 * navigateur ne saurait plus rouvrir. Ici, ce qui est notifié est ce qui est
 * durable.
 *
 * L'inversion évite aussi un cycle d'imports : `sync.ts` a besoin de ce module
 * pour écrire un projet tiré du cloud, ce module n'a besoin de rien de lui.
 */
export function onProjectCommitted(listener: CommitListener): () => void {
  commitListeners.add(listener)
  return () => {
    commitListeners.delete(listener)
  }
}

/**
 * La base, ouverte une fois pour tout ce qui persiste localement.
 *
 * Exportée pour les gabarits, et pour eux seuls : deux `openDB` sur le même nom
 * à deux versions différentes se bloquent l'un l'autre, donc il ne peut y avoir
 * qu'un endroit qui décrit ce schéma. La montée en v3 n'ouvre qu'un magasin de
 * plus — rien n'est relu, rien n'est réécrit, et une base v2 s'ouvre en v3 avec
 * ses projets et ses assets intacts.
 */
export function getDB(): Promise<IDBPDatabase<ScreenForgeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScreenForgeDB>('screenforge', 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' })
          store.createIndex('by-updated', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('assets')) {
          const store = db.createObjectStore('assets', { keyPath: 'id' })
          store.createIndex('by-project', 'projectId')
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' })
        }
      },
      blocking() {
        void dbPromise?.then((db) => db.close())
        dbPromise = null
      },
    })
  }
  return dbPromise
}

export class InvalidProjectRecordError extends Error {
  constructor() {
    super('Invalid ScreenForge project record.')
    this.name = 'InvalidProjectRecordError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

interface InlineAssetMigration {
  layer: Record<string, unknown>
  field: 'assetId' | 'screenshotAssetId'
  dataUrl: string
}

function prepareInlineAssets(value: unknown): InlineAssetMigration[] {
  if (!isRecord(value)) return []
  const collections = [
    ...(Array.isArray(value.screens)
      ? value.screens.flatMap((screen) =>
          isRecord(screen) && Array.isArray(screen.layers) ? [screen.layers] : [],
        )
      : []),
    ...(Array.isArray(value.layoutLayers) ? [value.layoutLayers] : []),
  ]
  const migrations: InlineAssetMigration[] = []
  for (const layers of collections) {
    for (const layer of layers) {
      if (!isRecord(layer)) continue
      if (layer.type !== 'image' && layer.type !== 'device-frame') continue
      const source = layer.type === 'image' ? layer.src : layer.screenshotUrl
      const field = layer.type === 'image' ? 'assetId' : 'screenshotAssetId'
      if (typeof source !== 'string' || !source.startsWith('data:')) continue
      layer[field] = `legacy_inline_${migrations.length}`
      delete layer[layer.type === 'image' ? 'src' : 'screenshotUrl']
      migrations.push({ layer, field, dataUrl: source })
    }
  }
  return migrations
}

/** Migrate supported legacy fields, then enforce the current project contract. */
export function normalizeProject(value: unknown): Project {
  const migrated = migrateProject(value)
  const inlineAssets = prepareInlineAssets(migrated)
  if (!isProject(migrated)) throw new InvalidProjectRecordError()
  for (const migration of inlineAssets) {
    migration.layer[migration.field] = registerAsset(migration.dataUrl)
  }
  if (!isProject(migrated)) throw new InvalidProjectRecordError()
  return migrated
}

async function commitProject(
  db: IDBPDatabase<ScreenForgeDB>,
  project: Project,
  deleteAssetIds: readonly string[] = [],
  notifyListeners = true,
): Promise<Project> {
  const normalized = normalizeProject(project)
  const dirty = readDirtyAssets()
  const tx = db.transaction(['projects', 'assets'], 'readwrite')
  const projects = tx.objectStore('projects')
  const assets = tx.objectStore('assets')
  const requests: Promise<unknown>[] = []
  const done = tx.done
  try {
    for (const asset of dirty) {
      requests.push(
        assets.put({
          id: asset.id,
          projectId: normalized.id,
          dataUrl: asset.dataUrl,
        }),
      )
    }
    for (const id of deleteAssetIds) requests.push(assets.delete(id))
    requests.push(projects.put(normalized))
    await Promise.all([...requests, done])
  } catch (error) {
    try {
      tx.abort()
    } catch {
      // The failing request may already have aborted the transaction.
    }
    await Promise.allSettled([...requests, done])
    throw error
  }
  markAssetsClean(dirty.map((asset) => asset.id))
  /* Il y a désormais quelque chose à perdre : c'est le moment de demander au
     navigateur de le garder. Sans attendre — la réponse ne conditionne rien de
     ce qui vient d'être écrit. */
  void ensureDurableStorage()
  // Après le commit, jamais avant : un abonné qui échoue ne doit pas pouvoir
  // annuler une sauvegarde locale déjà acquise.
  if (notifyListeners) {
    for (const listener of commitListeners) {
      try {
        listener(normalized)
      } catch (error) {
        console.error('A project commit listener failed.', error)
      }
    }
  }
  return normalized
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await commitProject(db, project)
}

/**
 * Demander au navigateur de ne pas effacer ce qu'on vient d'écrire.
 *
 * Sans cela, une base IndexedDB est en « meilleur effort », le seul mode que
 * les navigateurs s'autorisent à évincer tout seuls : Safari efface le stockage
 * écrit par script après sept jours sans visite, Chrome évince sous pression
 * disque. Pour un produit local-first, où le travail de l'utilisateur n'a
 * souvent aucune autre copie, c'est la perte qui n'a demandé aucun geste — ni le
 * sien, ni le nôtre. `persist()` fait passer l'origine en durable, que le
 * navigateur ne reprend plus de sa propre initiative.
 *
 * Demandé à la première écriture et pas au démarrage : Firefox pose la question
 * à l'utilisateur, et elle ne se justifie qu'une fois qu'il y a quelque chose à
 * perdre. Chrome et Safari décident seuls, sur leurs propres heuristiques, donc
 * un refus est banal et ne veut pas dire que la demande était mal placée.
 *
 * La promesse est mémorisée : la réponse ne change pas dans une session, et
 * redemander ferait reposer la question de Firefox à chaque sauvegarde. Un
 * rechargement redemande.
 */
let durability: Promise<boolean> | null = null

export function ensureDurableStorage(): Promise<boolean> {
  durability ??= (async () => {
    const manager = navigator.storage
    if (!manager?.persist) return false
    try {
      return (await manager.persisted()) || (await manager.persist())
    } catch (error) {
      console.warn('Could not request durable storage.', error)
      return false
    }
  })()
  return durability
}

/** Loads a project and its binary assets; migrates v1 inline payloads. */
async function loadProjectRecord(
  record: Project | undefined,
  notifyCommit = true,
): Promise<Project | undefined> {
  if (!record) return undefined
  const db = await getDB()
  const assets = await db.getAllFromIndex('assets', 'by-project', record.id)
  hydrateAssets(assets)
  const project = normalizeProject(record)
  const keepIds = collectAssetIds(project)
  const orphanIds = assets.flatMap((asset) => (keepIds.has(asset.id) ? [] : [asset.id]))
  sweepAssets(keepIds)
  // Rewrites legacy inline data and deletes orphans in the same durable commit.
  return commitProject(db, project, orphanIds, notifyCommit)
}

export async function loadProject(
  id: string,
  options: { notifyCommit?: boolean } = {},
): Promise<Project | undefined> {
  const db = await getDB()
  return loadProjectRecord(await db.get('projects', id), options.notifyCommit)
}

export async function loadLatestProject(): Promise<Project | undefined> {
  const db = await getDB()
  const all = await db.getAllFromIndex('projects', 'by-updated')
  let invalidFound = false
  for (let index = all.length - 1; index >= 0; index -= 1) {
    try {
      return await loadProjectRecord(all[index])
    } catch (error) {
      if (!(error instanceof InvalidProjectRecordError)) throw error
      invalidFound = true
      console.error('Ignored an invalid local project record.', error)
    }
  }
  if (invalidFound) {
    toast('Un projet local illisible a été conservé. Un nouveau projet a été ouvert.', 'error')
  }
  return undefined
}

export async function listProjects(): Promise<
  Pick<Project, 'id' | 'name' | 'target' | 'createdAt' | 'updatedAt'>[]
> {
  const db = await getDB()
  const all: unknown[] = await db.getAll('projects')
  return all.flatMap((record) => {
    if (
      !isRecord(record) ||
      typeof record.id !== 'string' ||
      !record.id ||
      typeof record.name !== 'string' ||
      typeof record.createdAt !== 'number' ||
      !Number.isFinite(record.createdAt) ||
      typeof record.updatedAt !== 'number' ||
      !Number.isFinite(record.updatedAt)
    ) {
      console.error('Ignored invalid local project metadata.', new InvalidProjectRecordError())
      return []
    }
    const normalized = migrateProject(record)
    if (!isRecord(normalized) || !isProject(normalized)) {
      console.error('Ignored invalid local project metadata.', new InvalidProjectRecordError())
      return []
    }
    const { id, name, target, createdAt, updatedAt } = normalized
    return [{ id, name, target, createdAt, updatedAt }]
  })
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingProject: Project | null = null
let saveSequence = 0
const inFlightSaves = new Map<Promise<void>, string>()

export async function deleteProject(id: string): Promise<void> {
  if (pendingProject?.id === id) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    pendingProject = null
  }
  const activeSaves = [...inFlightSaves].flatMap(([save, projectId]) =>
    projectId === id ? [save] : [],
  )
  await Promise.allSettled(activeSaves)

  const db = await getDB()
  const tx = db.transaction(['projects', 'assets'], 'readwrite')
  const assets = tx.objectStore('assets')
  const assetIds = await assets.index('by-project').getAllKeys(id)
  await Promise.all([
    tx.objectStore('projects').delete(id),
    ...assetIds.map((assetId) => assets.delete(assetId)),
    tx.done,
  ])
}

function remapLayerAssets(layer: Layer, ids: ReadonlyMap<string, string>): Layer {
  const copy = structuredClone(layer)
  if (copy.type === 'image') copy.assetId = ids.get(copy.assetId) ?? copy.assetId
  if (copy.type === 'device-frame') {
    if (copy.screenshotAssetId) {
      copy.screenshotAssetId = ids.get(copy.screenshotAssetId) ?? copy.screenshotAssetId
    }
    if (copy.importedBezel) {
      copy.importedBezel.assetId = ids.get(copy.importedBezel.assetId) ?? copy.importedBezel.assetId
    }
  }
  return copy
}

function importedProject(decoded: DecodedProjectFile): {
  project: Project
  assets: AssetRecord[]
} {
  const projectId = crypto.randomUUID()
  const idMap = new Map(decoded.assets.map((asset) => [asset.id, crypto.randomUUID()]))
  const now = Date.now()
  const project = normalizeProject({
    ...structuredClone(decoded.project),
    id: projectId,
    createdAt: now,
    updatedAt: now,
    screens: decoded.project.screens.map((screen) => ({
      ...structuredClone(screen),
      thumbnail: undefined,
      layers: screen.layers.map((layer) => remapLayerAssets(layer, idMap)),
    })),
    layoutLayers: decoded.project.layoutLayers.map((layer) => remapLayerAssets(layer, idMap)),
    /* Les releases sont remappées comme le reste : leur instantané référence
       les mêmes assets, et une release importée qui pointerait sur les
       identifiants de l'archive ne se rejouerait plus. */
    releases: (decoded.project.releases ?? []).map((release) => ({
      ...structuredClone(release),
      snapshot: {
        ...structuredClone(release.snapshot),
        screens: release.snapshot.screens.map((screen) => ({
          ...structuredClone(screen),
          layers: screen.layers.map((layer) => remapLayerAssets(layer, idMap)),
        })),
        layoutLayers: release.snapshot.layoutLayers.map((layer) => remapLayerAssets(layer, idMap)),
      },
    })),
  })
  const assets = decoded.assets.map((asset) => ({
    id: idMap.get(asset.id)!,
    projectId,
    dataUrl: asset.dataUrl,
  }))
  return { project, assets }
}

/**
 * Persist a complete remote bundle only while it still wins local LWW.
 *
 * The read and every project/asset mutation share one readwrite transaction:
 * another local commit either finishes before this read, or waits and writes
 * after this transaction. There is no stale-check window around the `put`.
 */
export async function storeRemoteProject(
  project: Project,
  assets: readonly { id: string; dataUrl: string }[],
): Promise<boolean> {
  const db = await getDB()
  const tx = db.transaction(['projects', 'assets'], 'readwrite')
  const projects = tx.objectStore('projects')
  const assetStore = tx.objectStore('assets')
  const requests: Promise<unknown>[] = []
  try {
    const current = await projects.get(project.id)
    if (current && current.updatedAt >= project.updatedAt) {
      await tx.done
      return false
    }

    const previousAssetIds = await assetStore.index('by-project').getAllKeys(project.id)
    const keep = new Set(assets.map((asset) => asset.id))
    requests.push(
      projects.put(project),
      ...assets.map((asset) => assetStore.put({ ...asset, projectId: project.id })),
      ...previousAssetIds.flatMap((id) => (keep.has(String(id)) ? [] : [assetStore.delete(id)])),
    )
    await Promise.all([...requests, tx.done])
    return true
  } catch (error) {
    try {
      tx.abort()
    } catch {
      // A failed request may already have aborted the transaction.
    }
    await Promise.allSettled([...requests, tx.done])
    throw error
  }
}

function activateProject(project: Project, assets: readonly AssetRecord[]): Project {
  hydrateAssets(assets)
  useProjectStore.getState().loadProject(project)
  useCanvasStore.getState().clearSelection()
  useHistoryStore.getState().clear()
  useUIStore.getState().setSaveStatus('saved')
  return project
}

/** Persists a project and its binaries in one transaction, then opens it. */
async function installProject(project: Project, assets: AssetRecord[]): Promise<Project> {
  if (!(await storeRemoteProject(project, assets))) {
    throw new Error('A newer local project already exists.')
  }
  return activateProject(project, assets)
}

/** Validates fully, then atomically persists and activates an independent project copy. */
export async function importPortableProject(file: File): Promise<Project> {
  const decoded = await readProjectFile(file)
  await saveCurrentProject()
  const imported = importedProject(decoded)
  return installProject(imported.project, imported.assets)
}

/**
 * Remplace le projet ouvert par la version tirée du cloud.
 *
 * Le flush préalable est ce qui rend l'opération non destructrice : si la
 * version distante porte un autre `id` — le cas du second navigateur — le
 * projet local reste en base sous le sien, et rien de ce qui n'avait pas encore
 * touché le disque n'est perdu.
 *
 * L'historique repart de zéro, comme à l'import d'un fichier : une pile
 * d'annulations qui traverserait un changement de document proposerait de
 * revenir à l'état d'un projet qui n'est plus à l'écran.
 */
export async function adoptRemoteProject(
  project: Project,
  assets: readonly { id: string; dataUrl: string }[],
): Promise<{ stored: boolean; activated: boolean }> {
  await saveCurrentProject()
  const activeAfterFlush = useProjectStore.getState().project
  const records = assets.map((asset) => ({ ...asset, projectId: project.id }))
  const stored = await storeRemoteProject(project, records)
  if (!stored) return { stored: false, activated: false }

  /* No await between this last store check and activation. If editing advanced
     while the IDB transaction ran, its autosave remains authoritative. */
  const activeBeforeActivation = useProjectStore.getState().project
  if (
    activeBeforeActivation?.id !== activeAfterFlush?.id ||
    activeBeforeActivation?.updatedAt !== activeAfterFlush?.updatedAt
  ) {
    return { stored: true, activated: false }
  }
  activateProject(project, records)
  return { stored: true, activated: true }
}

/** Saves the current document, then opens another project already in IndexedDB. */
export async function openStoredProject(id: string): Promise<Project | undefined> {
  if (useProjectStore.getState().project?.id === id)
    return useProjectStore.getState().project ?? undefined
  // Le popover n'est pas modal : une édition pendant un await recommence le
  // cycle afin d'être durable avant de remplacer le store actif.
  for (;;) {
    const current = useProjectStore.getState().project
    await saveCurrentProject()
    if (useProjectStore.getState().project !== current) continue

    const project = await loadProject(id)
    if (!project) return undefined
    if (useProjectStore.getState().project !== current) continue

    useProjectStore.getState().loadProject(project)
    useCanvasStore.getState().clearSelection()
    useHistoryStore.getState().clear()
    useUIStore.getState().setSaveStatus('saved')
    return project
  }
}

async function persist(project: Project): Promise<void> {
  const sequence = ++saveSequence
  useUIStore.getState().setSaveStatus('saving')
  const operation = saveProject(project)
  inFlightSaves.set(operation, project.id)
  try {
    await operation
    if (sequence === saveSequence) useUIStore.getState().setSaveStatus('saved')
  } catch (error) {
    if (sequence === saveSequence) useUIStore.getState().setSaveStatus('error')
    console.error('Could not save the project.', error)
    toast('Sauvegarde locale impossible. Vos modifications restent ouvertes.', 'error')
    throw error
  } finally {
    inFlightSaves.delete(operation)
  }
}

function flushPendingSave(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  const project = pendingProject
  pendingProject = null
  return project ? persist(project) : Promise.resolve()
}

function scheduleSave(project: Project) {
  pendingProject = project
  if (saveTimer) clearTimeout(saveTimer)
  useUIStore.getState().setSaveStatus('idle')
  saveTimer = setTimeout(() => {
    void flushPendingSave().catch(() => undefined)
  }, 2000)
}

export async function saveCurrentProject(): Promise<void> {
  const project = useProjectStore.getState().project
  if (!project) return
  pendingProject = project
  await flushPendingSave()
}

/** Saves the open document, creates and durably activates a complete new one. */
export async function createStoredProject(name: string, target: StoreTargetId): Promise<Project> {
  await saveCurrentProject()
  useProjectStore.getState().createProject(name, target)
  useCanvasStore.getState().clearSelection()
  useHistoryStore.getState().clear()
  await saveCurrentProject()
  const project = useProjectStore.getState().project
  if (!project) throw new Error('Project creation failed.')
  return project
}

/** Termine l'autosave avant un geste contrôlé qui quitte le document. */
export async function afterProjectSaved<T>(action: () => T | Promise<T>): Promise<T> {
  await saveCurrentProject()
  return await action()
}

export function initAutoSave(): () => void {
  const unsubscribe = useProjectStore.subscribe((state, previous) => {
    if (
      state.project &&
      (!previous.project ||
        state.project.id !== previous.project.id ||
        state.project.updatedAt !== previous.project.updatedAt)
    ) {
      scheduleSave(state.project)
    }
  })

  return () => {
    unsubscribe()
    void flushPendingSave().catch(() => undefined)
  }
}
