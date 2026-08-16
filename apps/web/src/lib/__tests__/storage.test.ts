import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAssets, readDirtyAssets, registerAsset, resolveAsset } from '@/lib/assets'
import {
  adoptRemoteProject,
  deleteProject,
  initAutoSave,
  listProjects,
  loadLatestProject,
  loadProject,
  saveCurrentProject,
  saveProject,
  storeRemoteProject,
} from '@/lib/storage'
import { useProjectStore } from '@/stores/project.store'
import type { Layer, Project } from '@/types'

function project(name = 'Project', layers: Layer[] = []): Project {
  return {
    id: 'project',
    name,
    activeScreenId: 'screen',
    screens: [
      {
        id: 'screen',
        name: 'Screen',
        background: { type: 'solid', color: '#fff' },
        layers,
      },
    ],
    layoutLayers: [],
    globals: {
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 40,
      fontColor: '#000',
      background: { type: 'solid', color: '#fff' },
      deviceModel: 'iphone-17-pro-max',
      deviceColor: 'silver',
    },
    createdAt: 1,
    updatedAt: 1,
  }
}

async function database() {
  // Sans numéro : `listProjects` a déjà ouvert la base à sa version courante, et
  // la répéter ici en fait un chiffre à mettre à jour à chaque montée de schéma
  // — ce qui a coûté douze tests en rouge sur un magasin ajouté ailleurs.
  await listProjects()
  return openDB('screenforge')
}

async function clearDatabase() {
  const db = await database()
  const tx = db.transaction(['projects', 'assets'], 'readwrite')
  await Promise.all([tx.objectStore('projects').clear(), tx.objectStore('assets').clear(), tx.done])
  db.close()
  clearAssets()
  useProjectStore.setState({ project: null })
}

describe('storage', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    await clearDatabase()
  })

  it('rolls back the project and keeps assets dirty after an asset write failure', async () => {
    await saveProject(project('Before'))
    const assetId = registerAsset('data:image/png;base64,aW1hZ2U=')
    const image: Layer = {
      id: 'image',
      type: 'image',
      name: 'Image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 0,
      assetId,
      originalWidth: 100,
      originalHeight: 100,
    }
    const originalPut = IDBObjectStore.prototype.put
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === 'assets') throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return originalPut.call(this, value, key)
    })

    await expect(saveProject(project('After', [image]))).rejects.toMatchObject({
      name: 'QuotaExceededError',
    })
    put.mockRestore()

    const db = await database()
    expect(((await db.get('projects', 'project')) as Project).name).toBe('Before')
    expect(await db.count('assets')).toBe(0)
    db.close()
    expect(readDirtyAssets().map((asset) => asset.id)).toEqual([assetId])

    await saveProject(project('After', [image]))
    expect(readDirtyAssets()).toEqual([])
  })

  it('deletes a project and its assets in one operation', async () => {
    const assetId = registerAsset('data:image/png;base64,aW1hZ2U=')
    const image = {
      id: 'image',
      type: 'image' as const,
      name: 'Image',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 0,
      assetId,
      originalWidth: 1,
      originalHeight: 1,
    }
    await saveProject(project('Project', [image]))
    await deleteProject('project')

    const db = await database()
    expect(await db.count('projects')).toBe(0)
    expect(await db.count('assets')).toBe(0)
    db.close()
  })

  it('installe un projet distant sans remplacer les assets du projet actif', async () => {
    const activeAsset = registerAsset('data:image/png;base64,YWN0aWY=')
    await saveProject(project('Actif'))
    const remote = { ...project('Distant'), id: 'remote' }

    await expect(
      storeRemoteProject(remote, [
        { id: 'remote-asset', dataUrl: 'data:image/png;base64,ZGlzdGFudA==' },
      ]),
    ).resolves.toBe(true)

    expect(resolveAsset(activeAsset)).toBe('data:image/png;base64,YWN0aWY=')
    expect(resolveAsset('remote-asset')).toBeUndefined()
    expect((await listProjects()).map(({ id }) => id)).toContain('remote')
  })

  it('refuse sans aucune mutation un bundle non ciblé devenu plus ancien', async () => {
    const local = { ...project('Local'), id: 'remote', updatedAt: 3 }
    await saveProject(local)
    const db = await database()
    await db.put('assets', {
      id: 'local-asset',
      projectId: local.id,
      dataUrl: 'data:image/png;base64,bG9jYWw=',
    })
    db.close()
    useProjectStore.getState().loadProject({ ...project('Actif'), id: 'active' })

    await expect(
      storeRemoteProject({ ...project('Remote ancien'), id: local.id, updatedAt: 2 }, [
        { id: 'remote-asset', dataUrl: 'data:image/png;base64,ZGlzdGFudA==' },
      ]),
    ).resolves.toBe(false)

    const stored = await database()
    expect((await stored.get('projects', local.id)) as Project).toMatchObject({
      name: 'Local',
      updatedAt: 3,
    })
    expect(await stored.get('assets', 'local-asset')).toBeDefined()
    expect(await stored.get('assets', 'remote-asset')).toBeUndefined()
    stored.close()
  })

  it('laisse un commit local démarré après la lecture gagner après le put distant', async () => {
    await saveProject({ ...project('Initial'), updatedAt: 1 })
    const originalPut = IDBObjectStore.prototype.put
    let localSave: Promise<void> | null = null
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: Project,
      key?: IDBValidKey,
    ) {
      if (this.name === 'projects' && value.name === 'Remote' && !localSave) {
        localSave = saveProject({ ...project('Local concurrent'), updatedAt: 3 })
      }
      return originalPut.call(this, value, key)
    })

    await expect(storeRemoteProject({ ...project('Remote'), updatedAt: 2 }, [])).resolves.toBe(true)
    await localSave
    put.mockRestore()

    const db = await database()
    expect((await db.get('projects', 'project')) as Project).toMatchObject({
      name: 'Local concurrent',
      updatedAt: 3,
    })
    db.close()
  })

  it('n’active pas le remote si le store avance pendant la transaction', async () => {
    const initial = { ...project('Initial'), updatedAt: 1 }
    const localConcurrent = { ...project('Local concurrent'), updatedAt: 3 }
    await saveProject(initial)
    useProjectStore.getState().loadProject(initial)
    const originalPut = IDBObjectStore.prototype.put
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: Project,
      key?: IDBValidKey,
    ) {
      if (this.name === 'projects' && value.name === 'Remote') {
        useProjectStore.getState().loadProject(localConcurrent)
      }
      return originalPut.call(this, value, key)
    })

    await expect(adoptRemoteProject({ ...project('Remote'), updatedAt: 2 }, [])).resolves.toEqual({
      stored: true,
      activated: false,
    })
    expect(useProjectStore.getState().project).toMatchObject({
      name: 'Local concurrent',
      updatedAt: 3,
    })
    put.mockRestore()

    await saveCurrentProject()
    const db = await database()
    expect((await db.get('projects', 'project')) as Project).toMatchObject({
      name: 'Local concurrent',
      updatedAt: 3,
    })
    db.close()
  })

  it('active nominalement un remote strictement plus récent', async () => {
    const initial = { ...project('Initial'), updatedAt: 1 }
    const remote = { ...project('Remote'), updatedAt: 2 }
    await saveProject(initial)
    useProjectStore.getState().loadProject(initial)

    await expect(adoptRemoteProject(remote, [])).resolves.toEqual({
      stored: true,
      activated: true,
    })
    expect(useProjectStore.getState().project).toMatchObject({ name: 'Remote', updatedAt: 2 })
  })

  it('deletes a project after an in-flight save fails', async () => {
    await saveProject(project('Before'))
    useProjectStore.getState().loadProject(project('After'))
    const originalPut = IDBObjectStore.prototype.put
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === 'projects') throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return originalPut.call(this, value, key)
    })

    const saving = saveCurrentProject().then(
      () => null,
      (error: unknown) => error,
    )
    await deleteProject('project')
    expect(await saving).toMatchObject({ name: 'QuotaExceededError' })
    put.mockRestore()

    const db = await database()
    expect(await db.get('projects', 'project')).toBeUndefined()
    db.close()
  })

  it('cancels a scheduled save before deleting the project', async () => {
    await saveProject(project('Before'))
    useProjectStore.getState().loadProject(project('Before'))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const unsubscribe = initAutoSave()
    useProjectStore.getState().updateProjectName('After')

    await deleteProject('project')
    await vi.advanceTimersByTimeAsync(2000)
    unsubscribe()
    vi.useRealTimers()

    const db = await database()
    expect(await db.get('projects', 'project')).toBeUndefined()
    db.close()
  })

  it('migrates inline data and removes persisted orphans on load', async () => {
    const legacy = structuredClone(project()) as unknown as {
      screens: Array<{ layers: object[] }>
    } & Record<string, unknown>
    legacy.screens[0].layers = [
      {
        id: 'image',
        type: 'image',
        name: 'Image',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 0,
        src: 'data:image/png;base64,bGVnYWN5',
        originalWidth: 1,
        originalHeight: 1,
      },
    ]
    const db = await database()
    await db.put('projects', legacy)
    await db.put('assets', {
      id: 'orphan',
      projectId: 'project',
      dataUrl: 'data:image/png;base64,b2xk',
    })
    db.close()

    const loaded = await loadProject('project')
    const layer = loaded?.screens[0].layers[0]
    expect(layer?.type).toBe('image')
    if (layer?.type !== 'image') throw new Error('Expected migrated image layer.')
    expect(resolveAsset(layer.assetId)).toBe('data:image/png;base64,bGVnYWN5')

    const stored = await database()
    const record = (await stored.get('projects', 'project')) as Project
    expect(record.screens[0].layers[0]).not.toHaveProperty('src')
    expect(await stored.get('assets', 'orphan')).toBeUndefined()
    stored.close()
  })

  it('migrates a legacy shape gradient before persisting the current model', async () => {
    const legacy = structuredClone(project()) as unknown as {
      screens: Array<{ layers: object[] }>
    } & Record<string, unknown>
    legacy.screens[0].layers = [
      {
        id: 'shape',
        type: 'shape',
        name: 'Shape',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 0,
        shapeType: 'rectangle',
        fill: '#000',
        gradientFill: {
          type: 'linear',
          angle: 90,
          stops: [
            { offset: 0, color: '#000' },
            { offset: 1, color: '#fff' },
          ],
        },
      },
    ]
    const db = await database()
    await db.put('projects', legacy)
    db.close()

    const loaded = await loadProject('project')
    expect(loaded?.screens[0].layers[0]).not.toHaveProperty('gradientFill')
    expect(loaded?.screens[0].layers[0]).toHaveProperty('fill.type', 'linear')
  })

  it('preserves an invalid latest record and loads the previous valid project', async () => {
    await saveProject(project('Valid'))
    const invalid = structuredClone(project('Invalid')) as unknown as Record<string, unknown>
    invalid.id = 'invalid'
    invalid.updatedAt = 2
    const screens = invalid.screens as Array<{ layers: Array<Record<string, unknown>> }>
    screens[0].layers = [
      {
        id: 'shape',
        type: 'shape',
        name: 'Shape',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        opacity: 2,
        locked: false,
        visible: true,
        zIndex: 0,
        shapeType: 'rectangle',
        fill: '#000',
      },
    ]
    const db = await database()
    await db.put('projects', invalid)
    db.close()

    expect((await loadLatestProject())?.name).toBe('Valid')
    const stored = await database()
    expect(await stored.get('projects', 'invalid')).toEqual(invalid)
    stored.close()
  })
})

/**
 * La demande de durabilité, qui n'a le droit d'être posée qu'une fois.
 *
 * Elle se mémorise dans le module, donc chaque cas repart d'un import neuf :
 * c'est la seule façon de vérifier qu'un second appel ne redemande rien, et
 * c'est précisément ce qui compte, puisque Firefox affiche la question à
 * l'utilisateur.
 */
describe('durabilité du stockage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  async function durability(storage: unknown) {
    vi.resetModules()
    vi.stubGlobal('navigator', { storage })
    const { ensureDurableStorage } = await import('@/lib/storage')
    return ensureDurableStorage
  }

  it('ne redemande pas ce que le navigateur a déjà accordé', async () => {
    const persist = vi.fn()
    const ensure = await durability({ persisted: () => Promise.resolve(true), persist })

    await expect(ensure()).resolves.toBe(true)
    await expect(ensure()).resolves.toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('ne pose la question qu’une fois, refus compris', async () => {
    const persist = vi.fn(() => Promise.resolve(false))
    const ensure = await durability({ persisted: () => Promise.resolve(false), persist })

    await expect(ensure()).resolves.toBe(false)
    await expect(ensure()).resolves.toBe(false)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('répond non sans lever quand le navigateur ne tient pas la promesse', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const unsupported = await durability(undefined)
    await expect(unsupported()).resolves.toBe(false)

    const refusing = await durability({
      persisted: () => Promise.reject(new Error('SecurityError')),
      persist: vi.fn(),
    })
    await expect(refusing()).resolves.toBe(false)
  })
})
