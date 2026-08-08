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
import type { Layer, Project } from '@/types'

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

function getDB(): Promise<IDBPDatabase<ScreenForgeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScreenForgeDB>('screenforge', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' })
          store.createIndex('by-updated', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('assets')) {
          const store = db.createObjectStore('assets', { keyPath: 'id' })
          store.createIndex('by-project', 'projectId')
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
  // Après le commit, jamais avant : un abonné qui échoue ne doit pas pouvoir
  // annuler une sauvegarde locale déjà acquise.
  for (const listener of commitListeners) {
    try {
      listener(normalized)
    } catch (error) {
      console.error('A project commit listener failed.', error)
    }
  }
  return normalized
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await commitProject(db, project)
}

/** Loads a project and its binary assets; migrates v1 inline payloads. */
async function loadProjectRecord(record: Project | undefined): Promise<Project | undefined> {
  if (!record) return undefined
  const db = await getDB()
  const assets = await db.getAllFromIndex('assets', 'by-project', record.id)
  hydrateAssets(assets)
  const project = normalizeProject(record)
  const keepIds = collectAssetIds(project)
  const orphanIds = assets.flatMap((asset) => (keepIds.has(asset.id) ? [] : [asset.id]))
  sweepAssets(keepIds)
  // Rewrites legacy inline data and deletes orphans in the same durable commit.
  return commitProject(db, project, orphanIds)
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  return loadProjectRecord(await db.get('projects', id))
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
  Pick<Project, 'id' | 'name' | 'createdAt' | 'updatedAt'>[]
> {
  const db = await getDB()
  const all = await db.getAll('projects')
  return all.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
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
  })
  const assets = decoded.assets.map((asset) => ({
    id: idMap.get(asset.id)!,
    projectId,
    dataUrl: asset.dataUrl,
  }))
  return { project, assets }
}

/** Persists a project and its binaries in one transaction, then opens it. */
async function installProject(project: Project, assets: AssetRecord[]): Promise<Project> {
  const db = await getDB()
  const tx = db.transaction(['projects', 'assets'], 'readwrite')
  await Promise.all([
    tx.objectStore('projects').put(project),
    ...assets.map((asset) => tx.objectStore('assets').put(asset)),
  ])
  await tx.done

  hydrateAssets(assets)
  useProjectStore.getState().loadProject(project)
  useCanvasStore.getState().clearSelection()
  useHistoryStore.getState().clear()
  useUIStore.getState().setSaveStatus('saved')
  return project
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
): Promise<void> {
  await saveCurrentProject()
  await installProject(
    project,
    assets.map((asset) => ({ ...asset, projectId: project.id })),
  )
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
