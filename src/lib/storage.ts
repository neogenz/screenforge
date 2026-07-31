import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import {
  hydrateAssets,
  registerAsset,
  takeDirtyAssets,
} from '@/lib/assets'
import { createDefaultScreen, DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import type { GlobalSettings, Layer, Project, Screen } from '@/types'

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
    })
  }
  return dbPromise
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function uniqueId(candidate: unknown, seen: Set<string>): string {
  const id = typeof candidate === 'string' && candidate && !seen.has(candidate)
    ? candidate
    : crypto.randomUUID()
  seen.add(id)
  return id
}

function normalizeLayer(
  value: unknown,
  seenIds: Set<string>,
  zIndex: number,
  scope?: 'layout',
): Layer | null {
  if (!value || typeof value !== 'object') return null
  const candidate = cloneValue(value) as Partial<Layer> & {
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
  }
  return normalized
}

function normalizeGlobals(value: unknown): GlobalSettings {
  const candidate = value && typeof value === 'object'
    ? value as Partial<GlobalSettings>
    : {}
  return {
    ...cloneValue(DEFAULT_GLOBALS),
    ...cloneValue(candidate),
    background: candidate.background
      ? cloneValue(candidate.background)
      : cloneValue(DEFAULT_GLOBALS.background),
  }
}

/** Convert legacy or partial IndexedDB values into a valid current project. */
export function normalizeProject(value: unknown): Project {
  const candidate = value && typeof value === 'object'
    ? value as Partial<Project>
    : {}
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
        ? cloneValue(screen.background)
        : cloneValue(globals.background),
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

/** Persists newly registered assets for this project (no-op when clean). */
async function flushDirtyAssets(
  db: IDBPDatabase<ScreenForgeDB>,
  projectId: string,
): Promise<void> {
  const dirty = takeDirtyAssets()
  if (dirty.length === 0) return
  const tx = db.transaction('assets', 'readwrite')
  await Promise.all(
    dirty.map((asset) => tx.store.put({ id: asset.id, projectId, dataUrl: asset.dataUrl })),
  )
  await tx.done
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await db.put('projects', normalizeProject(project))
  await flushDirtyAssets(db, project.id)
}

/** Loads a project and its binary assets; migrates v1 inline payloads. */
async function loadProjectRecord(record: Project | undefined): Promise<Project | undefined> {
  if (!record) return undefined
  const db = await getDB()
  const assets = await db.getAllFromIndex('assets', 'by-project', record.id)
  hydrateAssets(assets)
  const project = normalizeProject(record)
  // Inline data URLs found during normalization were registered as new
  // assets — persist them now so the migration is durable.
  await flushDirtyAssets(db, project.id)
  return project
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  return loadProjectRecord(await db.get('projects', id))
}

export async function loadLatestProject(): Promise<Project | undefined> {
  const db = await getDB()
  const all = await db.getAllFromIndex('projects', 'by-updated')
  return loadProjectRecord(all[all.length - 1])
}

export async function listProjects(): Promise<Pick<Project, 'id' | 'name' | 'createdAt' | 'updatedAt'>[]> {
  const db = await getDB()
  const all = await db.getAll('projects')
  return all.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('projects', id)
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
