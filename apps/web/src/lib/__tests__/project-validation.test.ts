import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  isProject,
  LISTING_DIRECTIONS,
  MAX_GRADIENT_STOPS,
  MAX_LAYER_TEXT_LENGTH,
  MAX_PROJECT_LAYERS,
  migrateProject,
} from '@/lib/project-validation'
import { APP_STORE_PROFILE, APP_STORE_PROFILES, GOOGLE_PLAY_PROFILE } from '@/lib/dimensions'
import { DIRECTIONS } from '@/lib/ai/plan'
import type { DeviceFrameLayer, Layer, Project, Release, StoreTargetId } from '@/types'

function deviceLayer(deviceModel: DeviceFrameLayer['deviceModel']): DeviceFrameLayer {
  return {
    id: 'device',
    type: 'device-frame',
    name: 'Device',
    x: 0,
    y: 0,
    width: 100,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    deviceModel,
    deviceColor: 'silver',
    orientation: 'portrait',
  }
}
function project(): Project {
  return {
    id: 'project',
    name: 'Project',
    target: 'app-store-iphone',
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
  it('keeps the eight official profiles unique and at their exact logical ratio', () => {
    expect(APP_STORE_PROFILES).toHaveLength(8)
    expect(new Set(APP_STORE_PROFILES.map(({ id }) => id)).size).toBe(8)
    expect(new Set(APP_STORE_PROFILES.map(({ zipFolder }) => zipFolder)).size).toBe(8)
    for (const profile of APP_STORE_PROFILES) {
      expect(profile.board.width / profile.board.height).toBeCloseTo(
        profile.output.portrait.width / profile.output.portrait.height,
        14,
      )
    }
    expect(
      APP_STORE_PROFILES.map(({ output, appStoreConnectType }) => [
        output.portrait.width,
        output.portrait.height,
        appStoreConnectType,
      ]),
    ).toEqual([
      [1320, 2868, 'APP_IPHONE_69'],
      [2064, 2752, 'APP_IPAD_PRO_3GEN_129'],
      [422, 514, 'APP_WATCH_ULTRA'],
      [410, 502, 'APP_WATCH_ULTRA'],
      [416, 496, 'APP_WATCH_SERIES_10'],
      [396, 484, 'APP_WATCH_SERIES_7'],
      [368, 448, 'APP_WATCH_SERIES_4'],
      [312, 390, 'APP_WATCH_SERIES_3'],
    ])
  })

  it('keeps target ids as a closed catalogue', () => {
    expectTypeOf<'app-store-ipad-13'>().toMatchTypeOf<StoreTargetId>()
    expectTypeOf<'outside-catalogue'>().not.toMatchTypeOf<StoreTargetId>()
  })

  it('accepts a complete current project', () => {
    expect(isProject(project())).toBe(true)
  })

  it('borne le brief de la fiche quand il est là, et l’ignore quand il n’y est pas', () => {
    const listing = {
      appName: 'Cadence',
      pitch: 'Le rythme de vos journées',
      direction: 'sobre',
      language: 'fr-FR',
    }
    expect(isProject({ ...project(), listing })).toBe(true)
    expect(isProject({ ...project(), listing: { ...listing, direction: 'flashy' } })).toBe(false)
    expect(isProject({ ...project(), listing: { ...listing, language: 'FR' } })).toBe(false)
    expect(isProject({ ...project(), listing: { ...listing, pitch: 'x'.repeat(141) } })).toBe(false)
    expect(isProject({ ...project(), listing: { ...listing, productContext: 'a' } })).toBe(true)
    expect(isProject({ ...project(), listing: { ...listing, appName: '' } })).toBe(true)
    expect(APP_STORE_PROFILE).toMatchObject({
      board: { width: 440, height: 956 },
      output: { portrait: { width: 1320, height: 2868 } },
      maxScreens: 10,
    })
    expect(GOOGLE_PLAY_PROFILE).toMatchObject({
      board: { width: 540, height: 960 },
      output: { portrait: { width: 1080, height: 1920 } },
      maxScreens: 8,
    })
  })

  it('migrates historical projects and release snapshots to App Store', () => {
    const legacy = structuredClone(project()) as unknown as Record<string, unknown>
    delete legacy.target
    legacy.releases = [
      {
        id: 'release',
        name: '1.0',
        createdAt: 1,
        watermarked: false,
        files: [],
        snapshot: {
          name: 'Project',
          screens: structuredClone(project().screens),
          layoutLayers: [],
          globals: structuredClone(project().globals),
        },
      },
    ]
    const migrated = migrateProject(legacy) as Project
    expect(migrated.target).toBe('app-store-iphone')
    expect(migrated.releases?.[0].snapshot.target).toBe('app-store-iphone')
    expect(isProject(migrated)).toBe(true)
  })

  it('enforces the screen ceiling of the selected target', () => {
    const android = project()
    android.target = 'google-play-phone'
    android.globals.deviceModel = 'android-phone'
    android.globals.deviceColor = 'black'
    android.screens = Array.from({ length: 8 }, (_, index) => ({
      ...structuredClone(android.screens[0]),
      id: `screen-${index}`,
      layers: [],
    }))
    android.activeScreenId = android.screens[0].id
    expect(isProject(android)).toBe(true)
    android.screens.push({ ...structuredClone(android.screens[0]), id: 'screen-8', layers: [] })
    expect(isProject(android)).toBe(false)
    expect(isProject({ ...project(), target: 'unknown-target' })).toBe(false)
  })

  it('rejects unknown and cross-platform models at the shared import/sync boundary', () => {
    const unknown = project()
    unknown.globals.deviceModel = 'unknown' as never
    expect(isProject(unknown)).toBe(false)

    const ipad = project()
    ipad.target = 'app-store-ipad-13'
    ipad.globals.deviceModel = 'tablet-slate'
    ipad.screens[0].layers = [deviceLayer('tablet-studio')]
    expect(isProject(ipad)).toBe(true)

    const crossPlatformGlobal = structuredClone(ipad)
    crossPlatformGlobal.globals.deviceModel = 'iphone-17-pro-max'
    expect(isProject(crossPlatformGlobal)).toBe(false)

    const crossPlatformLayer = structuredClone(ipad)
    crossPlatformLayer.screens[0].layers = [deviceLayer('watch-halo')]
    expect(isProject(crossPlatformLayer)).toBe(false)

    const legacyIphone = project()
    legacyIphone.globals.deviceModel = 'iphone-16-pro-max'
    legacyIphone.screens[0].layers = [deviceLayer('iphone-16-pro')]
    expect(isProject(legacyIphone)).toBe(true)
  })

  it('requires release snapshots to use the parent project target', () => {
    const candidate = project()
    candidate.releases = [
      {
        id: 'release',
        name: 'Release',
        createdAt: 1,
        watermarked: false,
        files: [],
        snapshot: {
          name: 'iPhone release',
          target: 'app-store-iphone',
          globals: structuredClone(candidate.globals),
          screens: [
            {
              ...candidate.screens[0],
              layers: [deviceLayer('iphone-17-pro-max')],
            },
          ],
          layoutLayers: [],
        },
      } satisfies Release,
    ]

    expect(isProject(candidate)).toBe(true)
    candidate.releases[0].snapshot.target = 'app-store-ipad-13'
    candidate.releases[0].snapshot.globals.deviceModel = 'tablet-slate'
    candidate.releases[0].snapshot.screens[0].layers = [deviceLayer('tablet-studio')]
    expect(isProject(candidate)).toBe(false)
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

  it('migrates legacy project and release profiles idempotently and rejects unknown ones', () => {
    const legacy = structuredClone(project()) as unknown as Record<string, unknown>
    delete legacy.target
    legacy.profileId = 'ipad-13'
    const ipadGlobals = structuredClone(project().globals)
    ipadGlobals.deviceModel = 'tablet-slate'
    legacy.releases = [
      {
        id: 'release',
        name: 'Release',
        createdAt: 1,
        watermarked: false,
        files: [],
        snapshot: {
          name: 'Project',
          profileId: 'ipad-13',
          screens: structuredClone(project().screens),
          layoutLayers: [],
          globals: ipadGlobals,
        },
      },
    ]
    legacy.globals = ipadGlobals

    const migrated = migrateProject(legacy) as Project
    expect(migrated.target).toBe('app-store-ipad-13')
    expect(migrated.releases?.[0].snapshot.target).toBe('app-store-ipad-13')
    expect(migrated).not.toHaveProperty('profileId')
    expect(migrated.releases?.[0].snapshot).not.toHaveProperty('profileId')
    expect(migrateProject(migrated)).toEqual(migrated)
    expect(isProject(migrated)).toBe(true)

    const unknown = { ...legacy, profileId: 'unknown' }
    expect(isProject(migrateProject(unknown))).toBe(false)
  })

  it('accepte exactement les directions que le planificateur sait peindre', () => {
    // Une cinquième direction ajoutée à `DIRECTIONS` sans le validateur échoue ici.
    expect([...LISTING_DIRECTIONS]).toEqual(DIRECTIONS.map((entry) => entry.id))
  })
})
