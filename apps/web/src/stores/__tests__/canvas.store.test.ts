import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '@/stores/canvas.store'
import { useHistoryStore } from '@/stores/history.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import type { ShapeLayer, TemplateDefinition } from '@/types'

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

  it('applies a template only inside its platform family', () => {
    const template: TemplateDefinition = {
      id: 'ipad-template',
      name: 'iPad',
      description: 'Test',
      profileId: 'ipad-13',
      background: { type: 'solid', color: '#ffffff' },
      layers: [shape()],
    }

    useProjectStore.getState().createProject('Watch', 'watch-series-10')
    expect(useCanvasStore.getState().applyTemplate(template, 'current')).toBeNull()
    expect(getProjectLayers(useProjectStore.getState().project)).toEqual([])

    useProjectStore.getState().createProject('iPad', 'ipad-13')
    expect(useCanvasStore.getState().applyTemplate(template, 'current')).toBeTruthy()
    expect(getProjectLayers(useProjectStore.getState().project)).toHaveLength(1)
  })
})
