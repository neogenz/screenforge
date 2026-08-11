import { beforeEach, describe, expect, it } from 'vitest'
import {
  AI_LIMITS,
  AI_TOOLS,
  applyToolCalls,
  PATCHABLE_PROPS,
  validateToolCall,
} from '@/lib/ai/tools'
import {
  planFromBrief,
  planToolCalls,
  isCampaignPlan,
  resolvePalette,
  restyleCalls,
} from '@/lib/ai/plan'
import { commitAiRun, discardAiAssets } from '@/lib/ai/run'
import { describeProject } from '@/lib/ai/state'
import { clearAssets, registerAsset, resolveAsset } from '@/lib/assets'
import { useHistoryStore } from '@/stores/history.store'
import { DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import type { CampaignBrief } from '@/lib/ai/plan'
import type { DeviceFrameLayer, Layer, Project, Screen, TextLayer } from '@/types'

function textLayer(id: string, content = 'Titre'): TextLayer {
  return {
    id,
    type: 'text',
    name: 'Texte',
    x: 10,
    y: 10,
    width: 100,
    height: 40,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    content,
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 600,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    textTransform: 'none',
  }
}

function deviceLayer(id: string): DeviceFrameLayer {
  return {
    id,
    type: 'device-frame',
    name: 'iPhone',
    x: 0,
    y: 0,
    width: 200,
    height: 400,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 1,
    deviceModel: 'iphone-17-pro-max',
    deviceColor: 'silver',
    orientation: 'portrait',
    placement: { mode: 'contain', focusX: 0.25, focusY: 0.75, zoom: 2 },
  }
}

function screen(id: string, layers: Layer[] = []): Screen {
  return { id, name: `Écran ${id}`, layers, background: { type: 'solid', color: '#000000' } }
}

function project(screens: Screen[] = [screen('s1')]): Project {
  return {
    id: 'p1',
    name: 'Projet',
    screens,
    activeScreenId: screens[0].id,
    globals: structuredClone(DEFAULT_GLOBALS),
    layoutLayers: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

const brief: CampaignBrief = {
  appName: 'Cadence',
  pitch: 'Le suivi de budget qui tient dans une poche',
  direction: 'contraste',
  screenCount: 2,
  deviceModel: 'iphone-17-pro-max',
  screenshots: [{ label: 'Budget' }, { label: 'Réglages' }],
}

beforeEach(() => {
  useProjectStore.setState({ project: null })
  useHistoryStore.setState({ past: [], future: [] })
  clearAssets()
})

describe('les schémas d’outils', () => {
  it('sont stricts : aucune propriété hors schéma n’est acceptée', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.parameters.type).toBe('object')
      expect(tool.parameters.additionalProperties).toBe(false)
    }
    expect(new Set(AI_TOOLS.map((tool) => tool.name)).size).toBe(AI_TOOLS.length)
  })

  it('refusent l’outil inconnu, la propriété inconnue et la valeur hors bornes', () => {
    expect(validateToolCall({ tool: 'set_fabric_json' as never, args: {} })).toMatch(/inconnu/)
    expect(
      validateToolCall({ tool: 'add_text', args: { content: 'Bonjour', style: 'gras' } }),
    ).toMatch(/inconnue/)
    expect(validateToolCall({ tool: 'add_text', args: {} })).toMatch(/requis/)
    expect(validateToolCall({ tool: 'add_text', args: { content: 'x', fontSize: 900 } })).toMatch(
      /maximum/,
    )
    expect(validateToolCall({ tool: 'add_text', args: { content: 'x', color: 'rouge' } })).toMatch(
      /format/,
    )
    expect(validateToolCall({ tool: 'add_shape', args: { shapeType: 'trapèze' } })).toMatch(
      /catalogue/,
    )
    expect(validateToolCall({ tool: 'add_text', args: { content: 'x' } })).toBeNull()
  })

  it('tiennent la lecture hors de l’exécuteur', () => {
    expect(validateToolCall({ tool: 'get_project_state', args: {} })).toMatch(/lecture seule/)
  })
})

describe('le constructeur', () => {
  it('pose de vrais calques ScreenForge, jamais du JSON opaque', () => {
    const draft = project()
    const outcome = applyToolCalls(draft, [
      { tool: 'add_screen', args: { name: 'Budget' } },
      { tool: 'add_text', args: { content: 'Tout voir', color: '#ffffff' } },
      { tool: 'add_device', args: { slot: 'Mon Budget' } },
    ])

    expect(outcome.error).toBeUndefined()
    const created = draft.screens[1]
    expect(created.name).toBe('Budget')
    expect(created.layers.map((layer) => layer.type)).toEqual(['text', 'device-frame'])
    expect((created.layers[0] as TextLayer).content).toBe('Tout voir')
    // Le rôle est normalisé, pas recopié : c'est lui qui appariera la release.
    expect((created.layers[1] as DeviceFrameLayer).slot).toBe('mon-budget')
    expect(created.layers.map((layer) => layer.zIndex)).toEqual([0, 1])
  })

  it('n’accepte d’un patch que ce que le type du calque connaît', () => {
    const draft = project([screen('s1', [textLayer('l1')])])
    expect(
      applyToolCalls(draft, [
        { tool: 'update_layer', args: { layerId: 'l1', patch: { content: 'Réécrit' } } },
      ]).error,
    ).toBeUndefined()
    expect((draft.screens[0].layers[0] as TextLayer).content).toBe('Réécrit')

    // Une propriété inconnue du schéma est refusée avant même l’allowlist…
    expect(
      applyToolCalls(draft, [
        { tool: 'update_layer', args: { layerId: 'l1', patch: { assetId: 'a1' } } },
      ]).error,
    ).toMatch(/inconnue/)
    // …et une propriété connue mais étrangère au type l’est par l’allowlist.
    expect(
      applyToolCalls(draft, [
        { tool: 'update_layer', args: { layerId: 'l1', patch: { iconId: 'star' } } },
      ]).error,
    ).toMatch(/pas modifiable/)
    expect(PATCHABLE_PROPS.text).not.toContain('zIndex')
    expect(PATCHABLE_PROPS.text).not.toContain('locked')
  })

  it('respecte le verrou et l’existence des calques', () => {
    const locked = textLayer('l1')
    locked.locked = true
    const draft = project([screen('s1', [locked])])
    expect(
      applyToolCalls(draft, [
        { tool: 'update_layer', args: { layerId: 'l1', patch: { content: 'Non' } } },
      ]).error,
    ).toMatch(/verrouillé/)
    expect(
      applyToolCalls(draft, [{ tool: 'delete_layer', args: { layerId: 'absent' } }]).error,
    ).toMatch(/introuvable/)
  })

  it('borne le nombre d’écrans et de calques', () => {
    const full = project(
      Array.from({ length: AI_LIMITS.maxScreens }, (_, index) => screen(`s${index}`)),
    )
    expect(applyToolCalls(full, [{ tool: 'add_screen', args: {} }]).error).toMatch(
      /Campagne pleine/,
    )

    const crowded = project([
      screen(
        's1',
        Array.from({ length: AI_LIMITS.maxLayersPerScreen }, (_, index) => textLayer(`l${index}`)),
      ),
    ])
    expect(
      applyToolCalls(crowded, [{ tool: 'add_text', args: { content: 'De trop' } }]).error,
    ).toMatch(/calques au plus/)
  })

  it('garde le cadrage quand la capture change, et refuse un asset étranger', () => {
    const draft = project([screen('s1', [deviceLayer('d1')])])
    const context = { assetIds: ['asset-connu'] }

    expect(
      applyToolCalls(
        draft,
        [
          {
            tool: 'place_screenshot_asset',
            args: { layerId: 'd1', assetId: 'asset-pirate', width: 10, height: 20 },
          },
        ],
        context,
      ).error,
    ).toMatch(/inconnue de ce run/)

    const outcome = applyToolCalls(
      draft,
      [
        {
          tool: 'place_screenshot_asset',
          args: { layerId: 'd1', assetId: 'asset-connu', width: 1320, height: 2868 },
        },
      ],
      context,
    )
    expect(outcome.error).toBeUndefined()
    const device = draft.screens[0].layers[0] as DeviceFrameLayer
    expect(device.screenshotAssetId).toBe('asset-connu')
    expect(device.placement).toEqual({ mode: 'contain', focusX: 0.25, focusY: 0.75, zoom: 2 })
  })

  it('enferme une édition ciblée dans son écran', () => {
    const draft = project([screen('s1', [textLayer('l1')]), screen('s2', [textLayer('l2')])])
    const scoped = { screenId: 's1' }

    expect(applyToolCalls(draft, [{ tool: 'add_screen', args: {} }], scoped).error).toMatch(
      /limitée à l’écran/,
    )
    expect(
      applyToolCalls(
        draft,
        [{ tool: 'update_layer', args: { layerId: 'l2', patch: { content: 'Ailleurs' } } }],
        scoped,
      ).error,
    ).toMatch(/limitée à l’écran/)
    expect(
      applyToolCalls(draft, [{ tool: 'add_text', args: { screenId: 's2', content: 'x' } }], scoped)
        .error,
    ).toMatch(/limitée à l’écran/)
    expect(draft.screens[1].layers).toHaveLength(1)
    expect((draft.screens[1].layers[0] as TextLayer).content).toBe('Titre')
  })
})

describe('le plan', () => {
  it('compose une planche par capture, avec rôle et direction', () => {
    const plan = planFromBrief(brief)
    expect(isCampaignPlan(plan)).toBe(true)
    expect(plan.screens.map((screen) => screen.slot)).toEqual(['budget', 'reglages'])
    expect(plan.screens[0].background).toEqual({ type: 'solid', color: '#101114' })
  })

  it('rejette ce qui n’en est pas un', () => {
    expect(isCampaignPlan({ ...planFromBrief(brief), direction: 'fluo' })).toBe(false)
    expect(isCampaignPlan({ ...planFromBrief(brief), screens: [] })).toBe(false)
    expect(isCampaignPlan(null)).toBe(false)
  })

  it('juge le fond sur le contrat du projet, pas sur « c’est un objet »', () => {
    // Ces deux-là passaient, s'affichaient comme un plan valide, et n'échouaient
    // qu'au clic sur « Poser », sur un message qui ne désignait pas le fond.
    const plan = planFromBrief(brief)
    const avec = (background: unknown) => ({
      ...plan,
      screens: [{ ...plan.screens[0], background }, ...plan.screens.slice(1)],
    })
    expect(isCampaignPlan(avec({}))).toBe(false)
    expect(isCampaignPlan(avec({ type: 'arc-en-ciel' }))).toBe(false)
    expect(isCampaignPlan(avec({ type: 'solid', color: 42 }))).toBe(false)
    expect(isCampaignPlan(avec({ type: 'solid', color: '#101114' }))).toBe(true)
  })

  it('ne rejoint le projet que par les outils', () => {
    const calls = planToolCalls(planFromBrief(brief), brief)
    expect(calls[0].tool).toBe('declare_plan')
    for (const call of calls) expect(validateToolCall(call)).toBeNull()
  })

  it('repeint un écran sans jamais rien créer', () => {
    const calls = restyleCalls(
      [
        { id: 'l1', type: 'text', locked: false },
        { id: 'l2', type: 'shape', locked: false },
        { id: 'l3', type: 'text', locked: true },
      ],
      resolvePalette({ direction: 'nocturne' }),
    )
    expect(calls.map((call) => call.tool)).toEqual([
      'set_background',
      'update_layer',
      'update_layer',
    ])
    expect(calls.some((call) => call.tool.startsWith('add_'))).toBe(false)
  })
})

describe('le run', () => {
  it('accepté, il vaut un seul pas d’annulation', () => {
    const before = project()
    useProjectStore.setState({ project: before })

    const outcome = commitAiRun(planToolCalls(planFromBrief(brief), brief))
    expect(outcome.committed).toBe(true)
    const after = useProjectStore.getState().project as Project
    // Deux captures au brief : deux planches de plus que l'écran d'origine.
    expect(after.screens).toHaveLength(3)
    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(outcome.screenIds).toHaveLength(2)
  })

  it('refusé, il ne laisse ni calque, ni écran, ni capture d’historique', () => {
    const before = project()
    useProjectStore.setState({ project: before })

    const outcome = commitAiRun([
      { tool: 'add_screen', args: { name: 'Budget' } },
      { tool: 'add_text', args: { content: 'Posé' } },
      { tool: 'update_layer', args: { layerId: 'fantôme', patch: { content: 'Non' } } },
    ])

    expect(outcome.committed).toBe(false)
    expect(outcome.error).toMatch(/introuvable/)
    expect(useProjectStore.getState().project).toBe(before)
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })

  /* Ce que la boîte de campagne délègue en la rappelant sans condition : elle
     ne sait pas ce que le plan a posé, cette fonction le sait pour elle. C'est
     ce qui rend un drapeau « accepté » non seulement inutile mais nuisible —
     il couvrait aussi les captures qu'un run accepté n'avait pas posées. */
  it('rend au néant ce que le projet ne référence pas, accepté ou non', () => {
    const kept = registerAsset('data:image/png;base64,AAAA')
    const dropped = registerAsset('data:image/png;base64,BBBB')
    const device = deviceLayer('d1')
    device.screenshotAssetId = kept
    useProjectStore.setState({ project: project([screen('s1', [device])]) })

    discardAiAssets([kept, dropped])
    expect(resolveAsset(kept)).toBeDefined()
    expect(resolveAsset(dropped)).toBeUndefined()
  })
})

describe('l’état montré au modèle', () => {
  it('ne laisse sortir aucune donnée binaire', () => {
    const device = deviceLayer('d1')
    device.screenshotAssetId = registerAsset('data:image/png;base64,AAAA')
    const view = describeProject(project([screen('s1', [textLayer('l1'), device])]))

    expect(JSON.stringify(view)).not.toContain('data:image')
    expect(JSON.stringify(view)).not.toContain(device.screenshotAssetId)
    expect(view.screens[0].layers[1].hasScreenshot).toBe(true)
    expect(view.canvas).toEqual({ width: 440, height: 956 })
  })
})
