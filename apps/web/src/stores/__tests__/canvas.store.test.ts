import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/stores/canvas.store'
import { useHistoryStore } from '@/stores/history.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import type { ShapeLayer } from '@/types'

function shape(id = 'shape'): ShapeLayer {
  return {
    id,
    type: 'shape',
    name: 'Shape',
    x: 10,
    y: 20,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    shapeType: 'rectangle',
    fill: '#000',
  }
}

describe('canvas store domain boundaries', () => {
  beforeEach(() => {
    useHistoryStore.getState().clear()
    useCanvasStore.setState({ selectedLayerIds: [] })
    useProjectStore.getState().createProject('Project')
  })

  it('does not mirror layers or the active screen', () => {
    expect(useCanvasStore.getState()).not.toHaveProperty('layers')
    expect(useCanvasStore.getState()).not.toHaveProperty('activeScreenId')
  })

  it('mutates local and layout layers only in the project store', () => {
    useCanvasStore.getState().addLayer(shape())
    expect(getProjectLayers(useProjectStore.getState().project).map((layer) => layer.id)).toEqual([
      'shape',
    ])

    useCanvasStore.getState().updateLayer('shape', { x: 42 })
    expect(getProjectLayers(useProjectStore.getState().project)[0].x).toBe(42)

    useCanvasStore.getState().setLayerScope('shape', 'layout')
    const project = useProjectStore.getState().project
    expect(project?.screens[0].layers).toEqual([])
    expect(project?.layoutLayers).toMatchObject([{ id: 'shape', scope: 'layout' }])
  })

  it('clears selection when the project changes active screen', () => {
    useCanvasStore.getState().addLayer(shape())
    const nextId = useProjectStore.getState().addScreen()
    expect(nextId).toBeTruthy()
    expect(useProjectStore.getState().project?.activeScreenId).toBe(nextId)
    expect(useCanvasStore.getState().selectedLayerIds).toEqual([])
  })

  it('uses the target screen ceiling for projects and templates', () => {
    useProjectStore.getState().createProject('Android', 'google-play-phone')
    for (let index = 1; index < 8; index += 1) {
      expect(useProjectStore.getState().addScreen()).toBeTruthy()
    }
    expect(useProjectStore.getState().addScreen()).toBeNull()
    expect(
      useProjectStore.getState().duplicateScreen(useProjectStore.getState().project!.screens[0].id),
    ).toBeNull()
  })

  it('undoes and redoes directly through the project store', () => {
    useCanvasStore.getState().addLayer(shape())
    expect(getProjectLayers(useProjectStore.getState().project)).toHaveLength(1)

    useCanvasStore.getState().undo()
    expect(getProjectLayers(useProjectStore.getState().project)).toEqual([])

    useCanvasStore.getState().redo()
    expect(getProjectLayers(useProjectStore.getState().project).map((layer) => layer.id)).toEqual([
      'shape',
    ])
  })
})
