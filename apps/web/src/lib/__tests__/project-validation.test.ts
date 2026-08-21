import { describe, expect, it } from 'vitest'
import {
  isProject,
  MAX_GRADIENT_STOPS,
  MAX_LAYER_TEXT_LENGTH,
  MAX_PROJECT_LAYERS,
  migrateProject,
} from '@/lib/project-validation'
import type { Layer, Project } from '@/types'

function project(): Project {
  return {
    id: 'project',
    name: 'Project',
    activeScreenId: 'screen',
    screens: [
      {
        id: 'screen',
        name: 'Screen',
        background: { type: 'solid', color: '#fff' },
        layers: [
          {
            id: 'shape',
            type: 'shape',
            name: 'Shape',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            zIndex: 0,
            shapeType: 'rectangle',
            fill: '#000',
          },
        ],
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

describe('project validation', () => {
  it('accepts a complete current project', () => {
    expect(isProject(project())).toBe(true)
  })

  it.each([
    [
      'missing field',
      (candidate: Record<string, unknown>) => {
        delete candidate.locked
      },
    ],
    [
      'invalid opacity',
      (candidate: Record<string, unknown>) => {
        candidate.opacity = 1.1
      },
    ],
    [
      'zero dimension',
      (candidate: Record<string, unknown>) => {
        candidate.width = 0
      },
    ],
    [
      'unknown discriminant',
      (candidate: Record<string, unknown>) => {
        candidate.type = 'background'
      },
    ],
  ])('rejects %s', (_, mutate) => {
    const candidate = project() as unknown as {
      screens: Array<{ layers: Record<string, unknown>[] }>
    }
    mutate(candidate.screens[0].layers[0])
    expect(isProject(candidate)).toBe(false)
  })

  it('rejects duplicate layer and screen ids', () => {
    const duplicateLayer = structuredClone(project())
    duplicateLayer.layoutLayers = [{ ...duplicateLayer.screens[0].layers[0], scope: 'layout' }]
    expect(isProject(duplicateLayer)).toBe(false)

    const duplicateScreen = structuredClone(project())
    duplicateScreen.screens.push(structuredClone(duplicateScreen.screens[0]))
    expect(isProject(duplicateScreen)).toBe(false)
  })

  it('rejects projects that exceed render complexity limits', () => {
    const tooMany = structuredClone(project())
    tooMany.screens[0].layers = Array.from({ length: MAX_PROJECT_LAYERS + 1 }, (_, index) => ({
      ...tooMany.screens[0].layers[0],
      id: `shape-${index}`,
      zIndex: index,
    }))
    expect(isProject(tooMany)).toBe(false)

    const tooMuchText = structuredClone(project())
    tooMuchText.screens[0].layers = [
      {
        ...tooMuchText.screens[0].layers[0],
        type: 'text',
        content: 'x'.repeat(MAX_LAYER_TEXT_LENGTH + 1),
        fontFamily: 'Inter',
        fontSize: 40,
        fontWeight: 400,
        color: '#000',
        textAlign: 'left',
        lineHeight: 1.2,
        letterSpacing: 0,
        textTransform: 'none',
      },
    ] as Layer[]
    expect(isProject(tooMuchText)).toBe(false)

    const tooManyStops = structuredClone(project())
    ;(tooManyStops.screens[0].layers[0] as Layer & { fill: unknown }).fill = {
      type: 'linear',
      angle: 0,
      stops: Array.from({ length: MAX_GRADIENT_STOPS + 1 }, (_, index) => ({
        offset: index / MAX_GRADIENT_STOPS,
        color: '#000',
      })),
    }
    expect(isProject(tooManyStops)).toBe(false)
  })

  it('migrates a legacy shape gradient into the current fill field', () => {
    const legacy = project() as unknown as {
      screens: Array<{ layers: Array<Record<string, unknown>> }>
    }
    const shape = legacy.screens[0].layers[0]
    shape.gradientFill = {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#000' },
        { offset: 1, color: '#fff' },
      ],
    }

    const migrated = migrateProject(legacy)
    expect(isProject(migrated)).toBe(true)
    expect((migrated as Project).screens[0].layers[0]).not.toHaveProperty('gradientFill')
    expect((migrated as Project).screens[0].layers[0]).toHaveProperty('fill.type', 'linear')
  })
})
