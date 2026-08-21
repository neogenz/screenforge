import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyRefresh,
  assignManually,
  describeFiles,
  fileSlot,
  pendingChanges,
  planRefresh,
  refreshTargets,
} from '@/lib/batch-refresh'
import { useHistoryStore } from '@/stores/history.store'
import { DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import type { DeviceFrameLayer, Layer, Project, Screen } from '@/types'

function deviceLayer(id: string, slot?: string, assetId?: string): DeviceFrameLayer {
  return {
    id,
    type: 'device-frame',
    name: `Cadre ${id}`,
    x: 40,
    y: 60,
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
    ...(slot ? { slot } : {}),
    ...(assetId ? { screenshotAssetId: assetId } : {}),
  }
}

/** Un calque de mise en page porte son `scope` : la validation l'exige. */
function layoutLayer(id: string, slot?: string, assetId?: string): DeviceFrameLayer {
  return { ...deviceLayer(id, slot, assetId), scope: 'layout' }
}

function screen(id: string, layers: Layer[]): Screen {
  return { id, name: `Écran ${id}`, layers, background: { type: 'solid', color: '#000000' } }
}

function project(screens: Screen[], layoutLayers: Layer[] = []): Project {
  return {
    id: 'p1',
    name: 'Projet',
    target: 'app-store-iphone',
    screens,
    activeScreenId: screens[0].id,
    globals: structuredClone(DEFAULT_GLOBALS),
    layoutLayers,
    createdAt: 1,
    updatedAt: 1,
  }
}

const shot = (assetId: string) => ({ assetId, size: { width: 1320, height: 2868 } })

beforeEach(() => {
  useProjectStore.setState({ project: null })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('le rôle d’un fichier', () => {
  it('se lit dans son nom, sans chemin ni extension', () => {
    expect(fileSlot('/tmp/Réglages Avancés.png')).toBe('reglages-avances')
  })

  it('vient du manifeste quand il y en a un', () => {
    expect(fileSlot('2026-08-10T12-00-00.png', { budget: '2026-08-10T12-00-00.png' })).toBe(
      'budget',
    )
  })

  it('reste celui du nom si le manifeste ne parle pas de ce fichier', () => {
    expect(fileSlot('budget.png', { onboarding: 'autre.png' })).toBe('budget')
  })
})

describe('le plan proposé', () => {
  const targets = refreshTargets(
    project(
      [
        screen('a', [deviceLayer('l1', 'budget', 'old-1')]),
        screen('b', [deviceLayer('l2', 'reglages')]),
      ],
      [layoutLayer('l3', 'budget')],
    ),
  )

  it('rend les appareils dans l’ordre lu, les calques de mise en page en dernier', () => {
    expect(targets.map((target) => target.layerId)).toEqual(['l1', 'l2', 'l3'])
    expect(targets[0]).toMatchObject({ screenRank: 1, scope: 'screen', currentAssetId: 'old-1' })
    expect(targets[2]).toMatchObject({ scope: 'layout' })
  })

  it('sert le même fichier à deux appareils qui portent le même rôle', () => {
    const plan = planRefresh(targets, describeFiles(['budget.png']))
    expect(plan.assignments.filter((entry) => entry.fileIndex === 0)).toHaveLength(2)
    expect(plan.unusedFileIndexes).toEqual([])
    expect(plan.unmatchedLayerIds).toEqual(['l2'])
  })

  it('ignore le rang que le simulateur met devant le rôle', () => {
    const plan = planRefresh(targets, describeFiles(['01_Budget.png', '02_Réglages.png']))
    expect(pendingChanges(plan).map((entry) => [entry.layerId, entry.fileIndex])).toEqual([
      ['l1', 0],
      ['l2', 1],
      ['l3', 0],
    ])
  })

  it('ne tranche pas entre deux fichiers qui réclament le même rôle', () => {
    const plan = planRefresh(targets, describeFiles(['budget.png', '01_budget.png']))
    expect(pendingChanges(plan)).toEqual([])
    expect(plan.duplicateSlots).toEqual([{ slot: 'budget', fileIndexes: [0, 1] }])
    expect(plan.unusedFileIndexes).toEqual([0, 1])
  })

  it('signale les fichiers sans destination sans les compter comme ambigus', () => {
    const plan = planRefresh(targets, describeFiles(['budget.png', 'panier.png', 'stock.png']))
    expect(plan.unusedFileIndexes).toEqual([1, 2])
    expect(plan.duplicateSlots).toEqual([])
  })

  it('n’apparie jamais d’office un appareil sans rôle', () => {
    const orphan = refreshTargets(project([screen('a', [deviceLayer('l9')])]))
    const plan = planRefresh(orphan, describeFiles(['l9.png']))
    expect(plan.slotlessLayerIds).toEqual(['l9'])
    expect(pendingChanges(plan)).toEqual([])
  })

  it('accepte la correction manuelle et recalcule ce qu’elle libère', () => {
    const files = describeFiles(['budget.png', 'inconnu.png'])
    const plan = planRefresh(targets, files)
    const corrected = assignManually(plan, targets, files, 'l2', 1)
    expect(corrected.assignments[1]).toEqual({ layerId: 'l2', fileIndex: 1, reason: 'manual' })
    expect(corrected.unusedFileIndexes).toEqual([])
    expect(corrected.unmatchedLayerIds).toEqual([])

    const cleared = assignManually(corrected, targets, files, 'l1', undefined)
    expect(cleared.assignments[0]).toEqual({ layerId: 'l1', reason: 'none' })
    expect(cleared.unmatchedLayerIds).toEqual(['l1'])
  })
})

describe('la pose du lot', () => {
  it('remplace toutes les captures en un seul pas d’annulation', () => {
    const before = project(
      [
        screen('a', [
          {
            ...deviceLayer('l1', 'budget', 'old-1'),
            placement: { mode: 'cover', zoom: 1.4, focusX: 0.2, focusY: 0.8 },
          },
        ]),
        screen('b', [deviceLayer('l2', 'reglages', 'old-2')]),
      ],
      [layoutLayer('l3', 'budget', 'old-3')],
    )
    useProjectStore.setState({ project: before })

    const targets = refreshTargets(before)
    const plan = planRefresh(targets, describeFiles(['budget.png', 'reglages.png']))
    const outcome = applyRefresh(plan.assignments, [shot('new-budget'), shot('new-reglages')])

    expect(outcome.committed).toBe(true)
    const after = useProjectStore.getState().project as Project
    expect(after.screens[0].layers[0]).toMatchObject({
      screenshotAssetId: 'new-budget',
      screenshotSize: { width: 1320, height: 2868 },
      // Ce que le remplacement n'a pas le droit de toucher.
      placement: { mode: 'cover', zoom: 1.4, focusX: 0.2, focusY: 0.8 },
      slot: 'budget',
      x: 40,
      y: 60,
    })
    expect(after.screens[1].layers[0]).toMatchObject({ screenshotAssetId: 'new-reglages' })
    expect(after.layoutLayers[0]).toMatchObject({ screenshotAssetId: 'new-budget' })
    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(after).not.toBe(before)
  })

  it('renonce entièrement si un appareil a disparu entre l’aperçu et la pose', () => {
    const before = project([screen('a', [deviceLayer('l1', 'budget', 'old-1')])])
    useProjectStore.setState({ project: before })

    const outcome = applyRefresh(
      [
        { layerId: 'l1', fileIndex: 0, reason: 'slot' },
        { layerId: 'disparu', fileIndex: 1, reason: 'manual' },
      ],
      [shot('new-1'), shot('new-2')],
    )

    expect(outcome).toMatchObject({ committed: false, reason: 'aborted' })
    expect(useProjectStore.getState().project).toBe(before)
    expect(useHistoryStore.getState().past).toEqual([])
  })

  it('n’écrit rien quand rien n’est apparié', () => {
    const before = project([screen('a', [deviceLayer('l1')])])
    useProjectStore.setState({ project: before })
    expect(applyRefresh([{ layerId: 'l1', reason: 'none' }], [])).toMatchObject({
      committed: false,
    })
    expect(useHistoryStore.getState().past).toEqual([])
  })
})
