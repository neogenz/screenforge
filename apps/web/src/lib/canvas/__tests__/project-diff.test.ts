import { describe, expect, it } from 'vitest'
import { diffProjectChange } from '@/lib/canvas/project-diff'
import type { Layer, Project, Screen } from '@/types'

function shape(id: string, zIndex = 0): Layer {
  return {
    id,
    type: 'shape',
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex,
    shapeType: 'rectangle',
    fill: '#000000',
  }
}

function screen(id: string, layers: Layer[] = []): Screen {
  return { id, name: id, layers, background: { type: 'solid', color: '#ffffff' } }
}

function project(screens: Screen[], layoutLayers: Layer[] = []): Project {
  return {
    id: 'project',
    name: 'Project',
    target: 'app-store-iphone',
    screens,
    activeScreenId: screens[0].id,
    globals: {
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 40,
      fontColor: '#000000',
      background: { type: 'solid', color: '#ffffff' },
      deviceModel: 'iphone-17-pro-max',
      deviceColor: 'silver',
    },
    layoutLayers,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('diffProjectChange', () => {
  it('returns none for unchanged references and full without a previous project', () => {
    const current = project([screen('screen-1')])
    expect(diffProjectChange(current, current)).toEqual({ type: 'none' })
    expect(diffProjectChange(current, null)).toEqual({ type: 'full' })
  })

  it('fully rebuilds when the project target changes', () => {
    const previous = project([screen('screen-1')])
    const current = {
      ...previous,
      target: 'google-play-phone' as const,
      globals: {
        ...previous.globals,
        deviceModel: 'android-phone' as const,
        deviceColor: 'black' as const,
      },
    }
    expect(diffProjectChange(current, previous)).toEqual({ type: 'full' })
  })

  it('targets a changed layer on one screen', () => {
    const layer = shape('layer-1')
    const previous = project([screen('screen-1', [layer])])
    const changed = { ...layer, x: 20 }
    const current = { ...previous, screens: [{ ...previous.screens[0], layers: [changed] }] }

    expect(diffProjectChange(current, previous)).toEqual({
      type: 'patch',
      screenId: 'screen-1',
      layerIds: ['layer-1'],
      layoutLayerIds: [],
      backgroundChanged: false,
    })
  })

  it('patches a background or an inactive screen independently', () => {
    const first = screen('screen-1')
    const second = screen('screen-2', [shape('layer-2')])
    const previous = project([first, second])
    const current = {
      ...previous,
      screens: [first, { ...second, layers: [{ ...second.layers[0], x: 10 }] }],
    }
    expect(diffProjectChange(current, previous)).toMatchObject({
      type: 'patch',
      screenId: 'screen-2',
      layerIds: ['layer-2'],
    })

    const background = { ...previous.screens[0].background, color: '#eeeeee' }
    const backgroundProject = {
      ...previous,
      screens: [{ ...first, background }, second],
    }
    expect(diffProjectChange(backgroundProject, previous)).toMatchObject({
      type: 'patch',
      screenId: 'screen-1',
      backgroundChanged: true,
    })
  })

  it('patches layout props and falls back for structural changes', () => {
    const layout = { ...shape('layout-1'), scope: 'layout' as const }
    const previous = project([screen('screen-1')], [layout])
    const current = { ...previous, layoutLayers: [{ ...layout, y: 20 }] }
    expect(diffProjectChange(current, previous)).toMatchObject({
      type: 'patch',
      layoutLayerIds: ['layout-1'],
    })

    const added = { ...previous, screens: [{ ...previous.screens[0], layers: [shape('new')] }] }
    expect(diffProjectChange(added, previous)).toEqual({ type: 'full' })

    const a = shape('a', 0)
    const b = shape('b', 1)
    const ordered = project([screen('screen-1', [a, b])])
    const reordered = { ...ordered, screens: [{ ...ordered.screens[0], layers: [b, a] }] }
    expect(diffProjectChange(reordered, ordered)).toEqual({ type: 'full' })
  })
})
