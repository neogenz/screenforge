import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import {
  hydrateAssets,
  markAssetsClean,
  readDirtyAssets,
  registerAsset,
  sweepAssets,
} from '@/lib/assets'
import { collectAssetIds } from '@/lib/asset-refs'
import { readProjectFile, type DecodedProjectFile } from '@/lib/project-file'
import { createDefaultScreen, DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useHistoryStore } from '@/stores/history.store'
import { toast } from '@/stores/toast.store'
import { useUIStore } from '@/stores/ui.store'
import type { GlobalSettings, ImportedDeviceBezel, Layer, Project, Screen } from '@/types'

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

function uniqueId(candidate: unknown, seen: Set<string>): string {
  const id = typeof candidate === 'string' && candidate && !seen.has(candidate)
    ? candidate
    : crypto.randomUUID()
  seen.add(id)
  return id
}

function normalizeImportedBezel(value: unknown): ImportedDeviceBezel | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<ImportedDeviceBezel>
  const screen = candidate.screen
  if (
    typeof candidate.assetId !== 'string' || !candidate.assetId
    || typeof candidate.fileName !== 'string' || !candidate.fileName
    || !Number.isFinite(candidate.naturalWidth) || (candidate.naturalWidth ?? 0) <= 0
    || !Number.isFinite(candidate.naturalHeight) || (candidate.naturalHeight ?? 0) <= 0
    || !screen
    || !Number.isFinite(screen.x) || screen.x < 0
    || !Number.isFinite(screen.y) || screen.y < 0
    || !Number.isFinite(screen.width) || screen.width <= 0
    || !Number.isFinite(screen.height) || screen.height <= 0
    || screen.x + screen.width > candidate.naturalWidth!
    || screen.y + screen.height > candidate.naturalHeight!
  ) return undefined

  return {
    assetId: candidate.assetId,
    fileName: candidate.fileName,
    naturalWidth: candidate.naturalWidth!,
    naturalHeight: candidate.naturalHeight!,
    screen: {
      x: screen.x,
      y: screen.y,
      width: screen.width,
      height: screen.height,
    },
  }
}

function normalizeLayer(
  value: unknown,
  seenIds: Set<string>,
  zIndex: number,
  scope?: 'layout',
): Layer | null {
  if (!value || typeof value !== 'object') return null
  const candidate = structuredClone(value) as Partial<Layer> & {
    src?: string
    screenshotUrl?: string
  }
  if (!['text', 'device-frame', 'image', 'shape'].includes(candidate.type ?? '')) return null
  const normalized = {
    ...candidate,
    id: uniqueId(candidate.id, seenIds),
    zIndex: scope && typeof candidate.zIndex === 'number' && Number.isFinite(candidate.zIndex)
      ? candidate.zIndex
      : zIndex,
    ...(scope ? { scope } : {}),
  } as Layer
  if (!scope) delete normalized.scope

  // Migration: inline data URLs move out of the layer graph into the asset
  // registry (v1 → v2). Layers keep only a short asset id.
  if (normalized.type === 'image') {
    const imageLayer = normalized as typeof normalized & { assetId?: string }
    if (typeof candidate.src === 'string' && candidate.src) {
      imageLayer.assetId = registerAsset(candidate.src)
    }
    delete (imageLayer as { src?: string }).src
  }
  if (normalized.type === 'device-frame') {
    const deviceLayer = normalized as typeof normalized & { screenshotAssetId?: string }
    if (typeof candidate.screenshotUrl === 'string' && candidate.screenshotUrl) {
      deviceLayer.screenshotAssetId = registerAsset(candidate.screenshotUrl)
    }
    delete (deviceLayer as { screenshotUrl?: string }).screenshotUrl
    const importedBezel = normalizeImportedBezel(deviceLayer.importedBezel)
    if (importedBezel) {
      deviceLayer.importedBezel = importedBezel
      deviceLayer.orientation = 'portrait'
    } else {
      delete deviceLayer.importedBezel
    }
  }
  return normalized
}

function normalizeGlobals(value: unknown): GlobalSettings {
  const candidate = value && typeof value === 'object'
    ? value as Partial<GlobalSettings>
    : {}
  return {
    ...structuredClone(DEFAULT_GLOBALS),
    ...structuredClone(candidate),
    background: candidate.background
      ? structuredClone(candidate.background)
      : structuredClone(DEFAULT_GLOBALS.background),
  }
}

/** Convert legacy or partial IndexedDB values into a valid current project. */
export function normalizeProject(value: unknown): Project {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidProjectRecordError()
  }
  const candidate = value as Partial<Project>
  if (typeof candidate.id !== 'string' || !candidate.id || !Array.isArray(candidate.screens)
    || candidate.screens.length === 0) {
    throw new InvalidProjectRecordError()
  }
  const globals = normalizeGlobals(candidate.globals)
  const screenIds = new Set<string>()
  const layerIds = new Set<string>()
  const rawScreens = Array.isArray(candidate.screens)
    ? candidate.screens.slice(0, MAX_PROJECT_SCREENS)
    : []

  const screens: Screen[] = rawScreens.flatMap((rawScreen, screenIndex) => {
    if (!rawScreen || typeof rawScreen !== 'object') return []
    const screen = rawScreen as Partial<Screen>
    const rawLayers = Array.isArray(screen.layers) ? screen.layers : []
    const layers = rawLayers.flatMap((layer, index) => {
      const normalized = normalizeLayer(layer, layerIds, index)
      return normalized ? [normalized] : []
    })
    return [{
      id: uniqueId(screen.id, screenIds),
      name: typeof screen.name === 'string' && screen.name.trim()
        ? screen.name
        : `Écran ${screenIndex + 1}`,
      layers,
      background: screen.background
        ? structuredClone(screen.background)
        : structuredClone(globals.background),
      ...(typeof screen.thumbnail === 'string' ? { thumbnail: screen.thumbnail } : {}),
    }]
  })

  if (screens.length === 0) {
    const screen = createDefaultScreen('Écran 1', globals)
    screenIds.add(screen.id)
    screens.push(screen)
  }

  const layoutLayers = Array.isArray(candidate.layoutLayers)
    ? candidate.layoutLayers.flatMap((layer, index) => {
        const normalized = normalizeLayer(layer, layerIds, index, 'layout')
        return normalized ? [normalized] : []
      })
    : []

  const now = Date.now()
  const activeScreenId = typeof candidate.activeScreenId === 'string'
    && screens.some((screen) => screen.id === candidate.activeScreenId)
    ? candidate.activeScreenId
    : screens[0].id
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : crypto.randomUUID(),
    name: typeof candidate.name === 'string' && candidate.name.trim()
      ? candidate.name
      : 'Projet sans titre',
    screens,
    activeScreenId,
    globals,
    layoutLayers,
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : now,
  }
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
      requests.push(assets.put({
        id: asset.id,
        projectId: normalized.id,
        dataUrl: asset.dataUrl,
      }))
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
  const orphanIds = assets.flatMap((asset) => keepIds.has(asset.id) ? [] : [asset.id])
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

export async function listProjects(): Promise<Pick<Project, 'id' | 'name' | 'createdAt' | 'updatedAt'>[]> {
  const db = await getDB()
  const all = await db.getAll('projects')
  return all.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
}

export async function deleteProject(id: string): Promise<void> {
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
      copy.importedBezel.assetId = ids.get(copy.importedBezel.assetId)
        ?? copy.importedBezel.assetId
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

/** Validates fully, then atomically persists and activates an independent project copy. */
export async function importPortableProject(file: File): Promise<Project> {
  const decoded = await readProjectFile(file)
  await saveCurrentProject()
  const imported = importedProject(decoded)
  const db = await getDB()
  const tx = db.transaction(['projects', 'assets'], 'readwrite')
  await Promise.all([
    tx.objectStore('projects').put(imported.project),
    ...imported.assets.map((asset) => tx.objectStore('assets').put(asset)),
  ])
  await tx.done

  hydrateAssets(imported.assets)
  useProjectStore.getState().loadProject(imported.project)
  useCanvasStore.getState().setActiveScreenId(imported.project.activeScreenId)
  useHistoryStore.getState().clear()
  useUIStore.getState().setSaveStatus('saved')
  return imported.project
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingProject: Project | null = null
let saveSequence = 0

async function persist(project: Project): Promise<void> {
  const sequence = ++saveSequence
  useUIStore.getState().setSaveStatus('saving')
  try {
    await saveProject(project)
    if (sequence === saveSequence) useUIStore.getState().setSaveStatus('saved')
  } catch (error) {
    if (sequence === saveSequence) useUIStore.getState().setSaveStatus('error')
    console.error('Could not save the project.', error)
    toast('Sauvegarde locale impossible. Vos modifications restent ouvertes.', 'error')
    throw error
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
      state.project
      && (
        !previous.project
        || state.project.id !== previous.project.id
        || state.project.updatedAt !== previous.project.updatedAt
      )
    ) {
      scheduleSave(state.project)
    }
  })

  return () => {
    unsubscribe()
    void flushPendingSave().catch(() => undefined)
  }
}
