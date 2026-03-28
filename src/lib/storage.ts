import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project } from '@/types'
import { useProjectStore } from '@/stores/project.store'

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

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await db.put('projects', project)
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  return db.get('projects', id)
}

export async function loadLatestProject(): Promise<Project | undefined> {
  const db = await getDB()
  const all = await db.getAllFromIndex('projects', 'by-updated')
  return all[all.length - 1]
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

// ─── Auto-save ───────────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSave(project: Project) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveProject(project).catch(console.error)
    saveTimer = null
  }, 2000)
}

export function initAutoSave(): () => void {
  return useProjectStore.subscribe((state) => {
    if (state.project) {
      debouncedSave(state.project)
    }
  })
}
