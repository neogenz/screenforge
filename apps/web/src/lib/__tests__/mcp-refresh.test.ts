import { beforeEach, describe, expect, it } from 'vitest'
import { refreshRelayScreenshots } from '@/lib/mcp/session'
import { clearAssets, registerAsset } from '@/lib/assets'
import { useHistoryStore } from '@/stores/history.store'
import { DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import type { RelayRefreshed } from 'mcp'
import type { DeviceFrameLayer, Layer, Project, Screen } from '@/types'

/**
 * La livraison, une fois arrivée dans l'onglet.
 *
 * L'appariement n'est pas retesté ici — c'est celui de `batch-refresh.test.ts`,
 * et le rejouer serait affirmer deux fois la même chose. Ce qui se vérifie,
 * c'est ce que la voie MCP ajoute : une seule écriture pour toute la livraison,
 * un cadrage que rien ne touche, et un rapport qui nomme ce qui n'a pas été
 * posé plutôt que de compter les succès.
 *
 * Les assets sont enregistrés localement avant l'appel, ce qui court-circuite
 * le téléchargement : `resolveRelayAssets` garde tel quel un identifiant que le
 * registre connaît déjà. Sans cela le test dépendrait du décodage d'image de
 * jsdom, qui n'en fait aucun.
 */

const PIXEL = 'data:image/png;base64,iVBORw0KGgo='

function deviceLayer(id: string, slot: string | undefined, zIndex: number): DeviceFrameLayer {
  return {
    id,
    type: 'device-frame',
    name: `iPhone ${id}`,
    x: 70,
    y: 190,
    width: 300,
    height: 600,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex,
    deviceModel: 'iphone-17-pro-max',
    deviceColor: 'silver',
    orientation: 'portrait',
    // Un cadrage que l'utilisateur a réglé : c'est lui qui doit survivre.
    placement: { mode: 'cover', focusX: 0.25, focusY: 0.75, zoom: 1.4 },
    ...(slot ? { slot } : {}),
  }
}

function screen(id: string, name: string, layers: Layer[]): Screen {
  return { id, name, layers, background: { type: 'solid', color: '#101010' } }
}

function project(screens: Screen[]): Project {
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

/** Un identifiant déjà connu du registre local : rien n'est téléchargé. */
const asset = () => registerAsset(PIXEL)

const fetchAsset = () => Promise.reject(new Error('aucun téléchargement attendu'))

beforeEach(() => {
  useProjectStore.setState({ project: null })
  useHistoryStore.setState({ past: [], future: [] })
  clearAssets()
})

describe('la livraison de captures reposée par le MCP', () => {
  it('pose tout le lot en une écriture, sans toucher au cadrage', async () => {
    useProjectStore.setState({
      project: project([
        screen('s1', 'Accueil', [deviceLayer('d1', 'accueil', 0)]),
        screen('s2', 'Budget', [deviceLayer('d2', 'budget', 0)]),
        screen('s3', 'Réglages', [deviceLayer('d3', 'reglages', 0)]),
      ]),
    })

    const outcome = await refreshRelayScreenshots(
      {
        files: [
          { name: 'accueil.png', assetId: asset(), width: 1320, height: 2868 },
          { name: 'budget.png', assetId: asset(), width: 1290, height: 2796 },
          { name: 'reglages.png', assetId: asset(), width: 1320, height: 2868 },
        ],
      },
      fetchAsset,
    )

    expect(outcome.committed).toBe(true)
    expect((outcome.result as RelayRefreshed).posed).toBe(3)
    // Trois captures, un seul Ctrl+Z : c'est toute la raison d'être de l'outil.
    expect(useHistoryStore.getState().past).toHaveLength(1)

    const after = useProjectStore.getState().project as Project
    for (const board of after.screens) {
      const device = board.layers[0] as DeviceFrameLayer
      expect(device.screenshotAssetId).toBeTruthy()
      expect(device.placement).toEqual({ mode: 'cover', focusX: 0.25, focusY: 0.75, zoom: 1.4 })
      expect(device.x).toBe(70)
      expect(device.width).toBe(300)
    }
    expect((after.screens[1].layers[0] as DeviceFrameLayer).screenshotSize).toEqual({
      width: 1290,
      height: 2796,
    })
  })

  it('nomme l’appareil sans rôle, avec son écran, et ne lui pose rien', async () => {
    useProjectStore.setState({
      project: project([
        screen('s1', 'Accueil', [deviceLayer('d1', 'accueil', 0)]),
        screen('s2', 'Budget', [deviceLayer('d2', undefined, 0)]),
      ]),
    })

    const outcome = await refreshRelayScreenshots(
      { files: [{ name: 'accueil.png', assetId: asset(), width: 1320, height: 2868 }] },
      fetchAsset,
    )

    const report = outcome.result as RelayRefreshed
    expect(report.posed).toBe(1)
    expect(report.slotless).toEqual(['Budget · iPhone d2'])
    const after = useProjectStore.getState().project as Project
    expect((after.screens[1].layers[0] as DeviceFrameLayer).screenshotAssetId).toBeUndefined()
  })

  it('rend l’ambiguïté plutôt que de trancher au hasard', async () => {
    useProjectStore.setState({
      project: project([screen('s1', 'Budget', [deviceLayer('d1', 'budget', 0)])]),
    })

    const outcome = await refreshRelayScreenshots(
      {
        files: [
          { name: 'budget.png', assetId: asset(), width: 1320, height: 2868 },
          { name: '01-budget.png', assetId: asset(), width: 1320, height: 2868 },
        ],
      },
      fetchAsset,
    )

    const report = outcome.result as RelayRefreshed
    expect(report.posed).toBe(0)
    expect(report.ambiguous[0]).toMatch(/budget/)
    // Rien posé, donc rien écrit : pas de pas d'annulation vide.
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })

  it('refuse un projet sans appareil, et un projet fermé', async () => {
    expect((await refreshRelayScreenshots({ files: [] }, fetchAsset)).error).toMatch(/Aucun projet/)

    useProjectStore.setState({ project: project([screen('s1', 'Accueil', [])]) })
    expect((await refreshRelayScreenshots({ files: [] }, fetchAsset)).error).toMatch(
      /Aucun appareil/,
    )
  })
})
