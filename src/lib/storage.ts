import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import { createDefaultScreen, DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import type { GlobalSettings, Layer, Project, Screen } from '@/types'

interface ScreenForgeDB extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { 'by-updated': number }
  }
}

let dbPromise: Promise<IDBPDatabase<ScreenForgeDB>> | null = null

function getDB(): Promise<IDBPDatabase<ScreenForgeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScreenForgeDB>('screenforge', 1, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('by-updated', 'updatedAt')
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

function normalizeLayer(value: unknown, seenIds: Set<string>, zIndex: number): Layer | null {
  if (!value || typeof value !== 'object') return null
  const candidate = cloneValue(value) as Partial<Layer>
  if (!['text', 'device-frame', 'image', 'shape'].includes(candidate.type ?? '')) return null
  const normalized = {
    ...candidate,
    id: uniqueId(candidate.id, seenIds),
    zIndex,
  } as Layer & { scope?: 'layout' }
  delete normalized.scope
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
        : `Screen ${screenIndex + 1}`,
      layers,
      background: screen.background
        ? cloneValue(screen.background)
        : cloneValue(globals.background),
      ...(typeof screen.thumbnail === 'string' ? { thumbnail: screen.thumbnail } : {}),
    }]
  })

  if (screens.length === 0) {
    const screen = createDefaultScreen('Screen 1', globals)
    screenIds.add(screen.id)
    screens.push(screen)
  }

  const legacyLayoutLayers = Array.isArray(candidate.layoutLayers)
    ? candidate.layoutLayers.flatMap((layer, index) => {
        const normalized = normalizeLayer(layer, layerIds, index)
        return normalized ? [normalized] : []
      })
    : []
  if (legacyLayoutLayers.length > 0) {
    screens[0] = {
      ...screens[0],
      layers: [...legacyLayoutLayers, ...screens[0].layers].map((layer, index) => ({
        ...layer,
        zIndex: index,
      })),
    }
  }

  const now = Date.now()
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : crypto.randomUUID(),
    name: typeof candidate.name === 'string' && candidate.name.trim()
      ? candidate.name
      : 'Untitled Project',
    screens,
    globals,
    layoutLayers: [],
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : now,
  }
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await db.put('projects', normalizeProject(project))
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  const project = await db.get('projects', id)
  return project ? normalizeProject(project) : undefined
}

export async function loadLatestProject(): Promise<Project | undefined> {
  const db = await getDB()
  const all = await db.getAllFromIndex('projects', 'by-updated')
  const project = all[all.length - 1]
  return project ? normalizeProject(project) : undefined
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
    if (state.project && state.project !== previous.project) scheduleSave(state.project)
  })

  return () => {
    unsubscribe()
    void flushPendingSave().catch(() => undefined)
  }
}
