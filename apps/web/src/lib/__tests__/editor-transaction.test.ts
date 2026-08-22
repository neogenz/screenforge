import { beforeEach, describe, expect, it } from 'vitest'
import { ABORT, runEditorTransaction } from '@/lib/editor-transaction'
import { useCanvasStore } from '@/stores/canvas.store'
import { useHistoryStore } from '@/stores/history.store'
import { DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import type { DeviceFrameLayer, ImageLayer, Layer, Project, Screen } from '@/types'

function imageLayer(id: string, assetId: string): ImageLayer {
  return {
    id,
    type: 'image',
    name: id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    assetId,
    originalWidth: 10,
    originalHeight: 10,
  }
}

function deviceLayer(id: string, screenshotAssetId?: string): DeviceFrameLayer {
  return {
    id,
    type: 'device-frame',
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    deviceModel: 'iphone-17-pro-max',
    deviceColor: 'space-black',
    orientation: 'portrait',
    ...(screenshotAssetId ? { screenshotAssetId } : {}),
  }
}

function screen(id: string, layers: Layer[] = []): Screen {
  return { id, name: id, layers, background: { type: 'solid', color: '#000000' } }
}

function project(screens: Screen[] = [screen('s1')], layoutLayers: Layer[] = []): Project {
  return {
    id: 'p1',
    name: 'Projet',
    profileId: 'iphone-6.9',
    screens,
    activeScreenId: screens[0].id,
    globals: structuredClone(DEFAULT_GLOBALS),
    layoutLayers,
    createdAt: 1000,
    updatedAt: 2000,
  }
}

function install(next: Project): void {
  useProjectStore.setState({ project: next })
  useHistoryStore.getState().clear()
  useCanvasStore.setState({ selectedLayerIds: [] })
}

describe('editor transaction', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null })
    useHistoryStore.getState().clear()
    useCanvasStore.setState({ selectedLayerIds: [] })
  })

  it('commits many screens as one history step and one project reference', () => {
    install(project([screen('s1', [deviceLayer('d1')]), screen('s2', [deviceLayer('d2')])]))
    const before = useProjectStore.getState().project

    const outcome = runEditorTransaction((draft) => {
      for (const target of draft.screens) {
        for (const layer of target.layers) {
          if (layer.type === 'device-frame') layer.screenshotAssetId = `shot-${layer.id}`
        }
      }
      return draft.screens.length
    })

    expect(outcome).toMatchObject({ committed: true, value: 2 })
    expect(useHistoryStore.getState().past).toHaveLength(1)
    const after = useProjectStore.getState().project
    expect(after).not.toBe(before)
    expect(after?.screens.map((s) => (s.layers[0] as DeviceFrameLayer).screenshotAssetId)).toEqual([
      'shot-d1',
      'shot-d2',
    ])
  })

  it('restores the whole batch in a single undo', () => {
    install(project([screen('s1', [deviceLayer('d1')]), screen('s2', [deviceLayer('d2')])]))

    runEditorTransaction((draft) => {
      for (const target of draft.screens) {
        for (const layer of target.layers) {
          if (layer.type === 'device-frame') layer.screenshotAssetId = 'shot'
        }
      }
    })
    useCanvasStore.getState().undo()

    const restored = useProjectStore.getState().project
    expect(
      restored?.screens.map((s) => (s.layers[0] as DeviceFrameLayer).screenshotAssetId),
    ).toEqual([undefined, undefined])
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })

  it('writes nothing when the mutation aborts', () => {
    install(project([screen('s1', [deviceLayer('d1')])]))
    const before = useProjectStore.getState().project

    const outcome = runEditorTransaction((draft) => {
      draft.screens[0].layers = []
      return ABORT
    })

    expect(outcome).toEqual({ committed: false, reason: 'aborted' })
    expect(useProjectStore.getState().project).toBe(before)
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })

  it('writes nothing when the mutation throws', () => {
    install(project([screen('s1', [deviceLayer('d1')])]))
    const before = useProjectStore.getState().project
    const boom = new Error('sixième fichier illisible')

    const outcome = runEditorTransaction<never>((draft) => {
      draft.screens[0].layers = []
      throw boom
    })

    expect(outcome).toEqual({ committed: false, reason: 'threw', error: boom })
    expect(useProjectStore.getState().project).toBe(before)
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })

  it('writes nothing when the draft breaks the project contract', () => {
    install(project([screen('s1', [deviceLayer('d1')])]))
    const before = useProjectStore.getState().project

    const outcome = runEditorTransaction((draft) => {
      draft.screens = []
    })

    expect(outcome).toEqual({ committed: false, reason: 'invalid' })
    expect(useProjectStore.getState().project).toBe(before)
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })

  it('reports added and orphaned assets without deleting either', () => {
    install(project([screen('s1', [imageLayer('i1', 'old-asset')])]))

    const outcome = runEditorTransaction((draft) => {
      draft.screens[0].layers = [imageLayer('i1', 'new-asset')]
    })

    expect(outcome).toMatchObject({
      committed: true,
      addedAssetIds: ['new-asset'],
      orphanedAssetIds: ['old-asset'],
    })
  })

  it('sees layout layers as part of the same batch', () => {
    install(project([screen('s1')], [{ ...deviceLayer('shared'), scope: 'layout' }]))

    const outcome = runEditorTransaction((draft) => {
      const shared = draft.layoutLayers[0]
      if (shared.type === 'device-frame') shared.screenshotAssetId = 'shot'
    })

    expect(outcome).toMatchObject({ committed: true, addedAssetIds: ['shot'] })
  })

  it('refuses the draft rather than duplicating an existing layer id', () => {
    install(project([screen('s1', [deviceLayer('d1')]), screen('s2', [deviceLayer('d2')])]))

    const outcome = runEditorTransaction((draft) => {
      draft.screens[1].layers = [deviceLayer('d1')]
    })

    expect(outcome).toEqual({ committed: false, reason: 'invalid' })
  })

  it('keeps the project identity and moves the clock forward', () => {
    install(project())

    runEditorTransaction((draft) => {
      draft.id = 'usurpé'
      draft.createdAt = 0
      draft.name = 'Renommé'
    })

    const after = useProjectStore.getState().project
    expect(after).toMatchObject({ id: 'p1', createdAt: 1000, name: 'Renommé' })
    expect(after?.updatedAt).toBeGreaterThan(2000)
  })

  it('falls back to a surviving screen when the batch removes the active one', () => {
    install(project([screen('s1'), screen('s2')]))
    useProjectStore.setState({
      project: { ...useProjectStore.getState().project!, activeScreenId: 's2' },
    })

    runEditorTransaction((draft) => {
      draft.screens = draft.screens.filter((target) => target.id !== 's2')
    })

    expect(useProjectStore.getState().project?.activeScreenId).toBe('s1')
  })

  it('drops only the selected layers the batch removed', () => {
    install(project([screen('s1', [deviceLayer('d1'), deviceLayer('d2')])]))
    useCanvasStore.setState({ selectedLayerIds: ['d1', 'd2'] })

    runEditorTransaction((draft) => {
      draft.screens[0].layers = draft.screens[0].layers.filter((layer) => layer.id !== 'd2')
    })

    expect(useCanvasStore.getState().selectedLayerIds).toEqual(['d1'])
  })

  it('reports no project when none is open', () => {
    expect(runEditorTransaction(() => 1)).toEqual({ committed: false, reason: 'no-project' })
  })
})
