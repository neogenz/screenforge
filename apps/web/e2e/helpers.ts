import { expect, type Download, type Page } from '@playwright/test'
import type { Canvas } from 'fabric'
import JSZip from 'jszip'
import type { Entitlements } from '../src/lib/entitlements'
import type { Theme } from '../src/lib/user-settings'
import type { SaveStatus, SyncStatus } from '../src/stores/ui.store'
import type { Layer, Project } from '../src/types'

/**
 * E2E helpers driving the app through its real UI, plus a dev-only debug
 * handle (`window.__sfCanvas`) exposed by use-canvas for state assertions.
 */

export interface ActiveObjectState {
  left: number
  top: number
  angle: number
  scaleX: number
  scaleY: number
  type: string
  isActiveSelection: boolean
}

/** Minimal shape of the debug objects read back from the canvas. */
export interface DebugObject {
  data?: {
    uid?: string
    layerId?: string
    screenId?: string
    screenIndex?: number
    clipScreenIndex?: number
    layout?: boolean
    rendererType?: string
    resourceKey?: string
  }
  left?: number
  top?: number
  angle?: number
  scaleX?: number
  scaleY?: number
  type?: string
  visible?: boolean
  text?: string
  isEditing?: boolean
  oCoords?: Record<string, { x: number; y: number }>
  getCenterPoint?: () => { x: number; y: number }
  getBoundingRect?: () => { left: number; top: number; width: number; height: number }
}

declare global {
  interface Window {
    __sfCanvas?: Canvas
    __sfCrash?: () => void
    /** Incrémenté par chaque full sync, jamais par un patch : c'est le témoin
        qui prouve qu'un scrub continu reste sur le chemin patch. */
    __sfSyncVersion?: { current: number }
    /**
     * Le registre d'assets de l'application.
     *
     * À importer depuis la page par `import('/src/lib/assets.ts')`, on obtient
     * une seconde instance : après un HMR, Vite horodate le spécificateur
     * (`?t=…`) dans le code applicatif, et les deux URL ne partagent plus rien.
     * Les assets enregistrés par le test devenaient alors invisibles au code
     * testé, qui échouait en `missing-current-asset`.
     */
    __sfAssets?: typeof import('../src/lib/assets')
    __sfStores?: {
      useAuthStore: {
        setState: (partial: { entitlements: Entitlements | null }) => void
        getState: () => { entitlements: Entitlements | null }
      }
      useHistoryStore: { getState: () => { past: unknown[]; future: unknown[] } }
      useCanvasStore: {
        getState: () => {
          selectedLayerIds: string[]
          updateLayer: (id: string, updates: Partial<Layer>) => void
        }
      }
      useProjectStore: {
        setState: (partial: { project: Project | null }) => void
        getState: () => {
          project: Project | null
          createProject: (name: string) => void
          addScreenLayer: (screenId: string, layer: Layer) => void
          updateScreenBackground: (
            screenId: string,
            background: Project['globals']['background'],
          ) => void
        }
      }
      useUIStore: {
        /* Les deux témoins de la barre se posent d'ici : les états les plus
           larges — « Modifications non enregistrées », « Hors ligne » — ne se
           produisent pas dans une suite sans disque plein ni réseau coupé, et
           ce sont eux qui décident de la largeur de la rangée. */
        setState: (partial: { saveStatus?: SaveStatus; syncStatus?: SyncStatus }) => void
        getState: () => {
          syncStatus: SyncStatus
          theme: Theme
          setZoom: (zoom: number) => void
          toggleTheme: () => void
          zoomIn: () => void
          zoomOut: () => void
          toggleLayers: () => void
          toggleProps: () => void
          layersOpen: boolean
          propsOpen: boolean
        }
      }
    }
  }
}

export async function waitForApp(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 15_000 })
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__sfCanvas
          ?.getObjects()
          .some((object) => (object as DebugObject).data?.rendererType === 'background'),
      ),
    )
    .toBe(true)
}

export async function addTextLayer(page: Page): Promise<void> {
  const count = await projectLayerCount(page)
  await page.locator('button[aria-label="Ajouter Texte"]').click()
  await expect.poll(() => projectLayerCount(page)).toBe(count + 1)
  await expect.poll(async () => Boolean(await findObject(page, 'text'))).toBe(true)
}

export async function addShapeLayer(page: Page): Promise<void> {
  const count = await projectLayerCount(page)
  await page.locator('button[aria-label="Ajouter Forme"]').click()
  await expect.poll(() => projectLayerCount(page)).toBe(count + 1)
  await expect.poll(async () => Boolean(await findObject(page, 'shape'))).toBe(true)
}

export async function addDeviceLayer(page: Page): Promise<void> {
  await page.locator('button[aria-label="Ajouter un cadre iPhone"]').click()
  const model = page.getByRole('menuitem', { name: /iPhone 17 Pro Max/ })
  await expect(model).toBeVisible()
  await model.click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__sfStores?.useProjectStore.getState().project
        const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
        return [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].some(
          (layer) => layer.type === 'device-frame',
        )
      }),
    )
    .toBe(true)
}

/**
 * Pose les droits comme le ferait un achat encaissé.
 *
 * L'achat réel traverse Polar, un webhook et le miroir en base : hors de portée
 * d'une suite qui doit rester exécutable sans Docker et sans compte marchand.
 * Ce que les tests vérifient est ce qui vient après — uniquement la sync Cloud.
 */
export async function grantEntitlements(
  page: Page,
  rights: { licence?: boolean; cloud?: boolean },
): Promise<void> {
  await page.evaluate((granted) => {
    window.__sfStores?.useAuthStore.setState({
      entitlements: {
        userId: 'e2e',
        cloud: granted.cloud ?? false,
        cloudStatus: granted.cloud ? 'active' : null,
        cloudPeriodEnd: granted.cloud ? '2099-01-01T00:00:00Z' : null,
      },
    })
  }, rights)
}

export interface ExportedZipPng {
  names: string[]
  png: Uint8Array
}

export async function readDownload(download: Download): Promise<Uint8Array> {
  expect(await download.failure()).toBeNull()
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/**
 * Le chemin du ZIP est universel en Local : aucun droit n'est posé ici.
 */
export async function downloadFirstExportedPng(page: Page): Promise<ExportedZipPng> {
  await page.getByLabel('Ouvrir l’export').click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: 'Exporter le ZIP' }).click(),
  ])
  const zip = await JSZip.loadAsync(await readDownload(download))
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir)
  const entry = zip.files[names[0]]
  if (!entry) throw new Error('exported PNG missing')
  return { names, png: await entry.async('uint8array') }
}

export async function addScreen(page: Page): Promise<void> {
  const count = await page.evaluate(
    () => window.__sfStores?.useProjectStore.getState().project?.screens.length ?? 0,
  )
  await page.locator('button[aria-label="Ajouter un écran"]').click()
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__sfStores?.useProjectStore.getState().project?.screens.length ?? 0,
      ),
    )
    .toBe(count + 1)
  await expect(page.locator('button[aria-label^="Activer"]')).toHaveCount(count + 1)
}

async function projectLayerCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    if (!project) return 0
    return (
      project.layoutLayers.length +
      project.screens.reduce((total, screen) => total + screen.layers.length, 0)
    )
  })
}

/** Wait until project and rendered-object state stop changing across polls. */
export async function waitForCanvasSettled(page: Page): Promise<void> {
  let previous = ''
  let stablePolls = 0
  await expect
    .poll(
      async () => {
        const current = await page.evaluate(() =>
          JSON.stringify({
            project: window.__sfStores?.useProjectStore.getState().project,
            selection: window.__sfStores?.useCanvasStore.getState().selectedLayerIds,
            objects: window.__sfCanvas?.getObjects().map((object) => {
              const debug = object as DebugObject
              return {
                data: debug.data,
                left: debug.left,
                top: debug.top,
                angle: debug.angle,
                scaleX: debug.scaleX,
                scaleY: debug.scaleY,
                visible: debug.visible,
                text: debug.text,
                isEditing: debug.isEditing,
              }
            }),
          }),
        )
        stablePolls = current === previous ? stablePolls + 1 : 0
        previous = current
        return stablePolls >= 2
      },
      { timeout: 5_000, intervals: [50, 100, 200, 400] },
    )
    .toBe(true)
}

export function layerRows(page: Page) {
  return page.locator('[data-layer-id]')
}

export async function findObject(page: Page, rendererType: string): Promise<DebugObject | null> {
  return page.evaluate((type) => {
    const canvas = window.__sfCanvas
    const object = (canvas?.getObjects() as DebugObject[] | undefined)?.find(
      (candidate) => candidate.data?.rendererType === type,
    )
    if (!object) return null
    return JSON.parse(
      JSON.stringify({
        data: object.data,
        left: object.left,
        top: object.top,
        angle: object.angle,
        scaleX: object.scaleX,
        scaleY: object.scaleY,
        type: object.type,
        visible: object.visible,
        text: object.text,
      }),
    ) as DebugObject
  }, rendererType)
}

export async function activeObjectState(page: Page): Promise<ActiveObjectState | null> {
  return page.evaluate(() => {
    const canvas = window.__sfCanvas
    const active = canvas?.getActiveObject() as DebugObject | undefined
    if (!active?.type) return null
    return {
      left: active.left ?? 0,
      top: active.top ?? 0,
      angle: active.angle ?? 0,
      scaleX: active.scaleX ?? 1,
      scaleY: active.scaleY ?? 1,
      type: active.type,
      isActiveSelection: active.type === 'activeselection',
    }
  })
}

/** Scene-space state of every rendered instance for a renderer type. */
export async function objectStates(page: Page, rendererType: string): Promise<ActiveObjectState[]> {
  return page.evaluate((type) => {
    const canvas = window.__sfCanvas
    return ((canvas?.getObjects() ?? []) as DebugObject[])
      .filter((object) => object.data?.rendererType === type)
      .map((object) => ({
        left: object.left ?? 0,
        top: object.top ?? 0,
        angle: object.angle ?? 0,
        scaleX: object.scaleX ?? 1,
        scaleY: object.scaleY ?? 1,
        type: object.type ?? '',
        isActiveSelection: false,
      }))
  }, rendererType)
}

/** Screen position of a named control handle (tl, tr, br, bl, mtr…). */
export async function controlPosition(
  page: Page,
  name: string,
): Promise<{ x: number; y: number } | null> {
  return page.evaluate((controlName) => {
    const canvas = window.__sfCanvas
    const active = canvas?.getActiveObject() as DebugObject | undefined
    const point = active?.oCoords?.[controlName]
    if (!point || !canvas) return null
    const rect = canvas.upperCanvasEl.getBoundingClientRect()
    return { x: rect.left + point.x, y: rect.top + point.y }
  }, name)
}

export async function dragControl(page: Page, name: string, dx: number, dy: number): Promise<void> {
  const pos = await controlPosition(page, name)
  if (!pos) throw new Error(`Control ${name} not found — is an object selected?`)
  await page.mouse.move(pos.x, pos.y)
  await page.mouse.down()
  await page.mouse.move(pos.x + dx, pos.y + dy, { steps: 12 })
  await page.mouse.up()
}

/** Screen position of the active object's center. */
export async function activeCenter(page: Page): Promise<{ x: number; y: number }> {
  const pos = await page.evaluate(() => {
    const canvas = window.__sfCanvas
    const active = canvas?.getActiveObject() as DebugObject | undefined
    if (!active?.getCenterPoint || !canvas) return null
    const rect = canvas.upperCanvasEl.getBoundingClientRect()
    const viewport = canvas.viewportTransform
    const center = active.getCenterPoint()
    return {
      x: rect.left + center.x * viewport[0] + viewport[4],
      y: rect.top + center.y * viewport[3] + viewport[5],
    }
  })
  if (!pos) throw new Error('No active object')
  return pos
}

/** Page-pixel center of an artboard, ordered from left to right. */
export async function screenCenter(page: Page, index: number): Promise<{ x: number; y: number }> {
  const pos = await page.evaluate((screenIndex) => {
    const canvas = window.__sfCanvas
    if (!canvas) return null
    const backgrounds = (canvas.getObjects() as DebugObject[])
      .filter((object) => object.data?.rendererType === 'background')
      .sort((left, right) => (left.left ?? 0) - (right.left ?? 0))
    const background = backgrounds[screenIndex]
    if (!background?.getCenterPoint) return null
    const rect = canvas.upperCanvasEl.getBoundingClientRect()
    const viewport = canvas.viewportTransform
    const center = background.getCenterPoint()
    return {
      x: rect.left + center.x * viewport[0] + viewport[4],
      y: rect.top + center.y * viewport[3] + viewport[5],
    }
  }, index)
  if (!pos) throw new Error(`Screen ${index} not found`)
  return pos
}

/**
 * Le lasso, dedans la planche : un rectangle tiré de coin à coin sur le fond
 * d'une planche, qui n'est pas `evented` — le geste y commence donc une
 * sélection au lieu de saisir un calque. Bordé à 2 % pour rester à l'intérieur
 * du cadrage visible quel que soit l'ajustement, et Fabric sélectionne à
 * l'intersection : tout calque de la planche y tombe.
 */
export async function lassoOverScreen(page: Page, screenIndex: number): Promise<void> {
  const box = await page.evaluate((index) => {
    const canvas = window.__sfCanvas
    if (!canvas) return null
    const background = (canvas.getObjects() as DebugObject[])
      .filter((object) => object.data?.rendererType === 'background')
      .sort((left, right) => (left.left ?? 0) - (right.left ?? 0))[index]
    if (!background?.getBoundingRect) return null
    const scene = background.getBoundingRect()
    const element = canvas.upperCanvasEl.getBoundingClientRect()
    const viewport = canvas.viewportTransform
    const toPage = (x: number, y: number) => ({
      x: element.left + x * viewport[0] + viewport[4],
      y: element.top + y * viewport[3] + viewport[5],
    })
    return {
      from: toPage(scene.left + scene.width * 0.02, scene.top + scene.height * 0.02),
      to: toPage(scene.left + scene.width * 0.98, scene.top + scene.height * 0.98),
    }
  }, screenIndex)
  if (!box) throw new Error(`Artboard ${screenIndex} not found`)
  await page.mouse.move(box.from.x, box.from.y)
  await page.mouse.down()
  await page.mouse.move(box.to.x, box.to.y, { steps: 12 })
  await page.mouse.up()
}

export async function dragActiveBody(page: Page, dx: number, dy: number): Promise<void> {
  const center = await activeCenter(page)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + dx, center.y + dy, { steps: 12 })
  await page.mouse.up()
}

export function expectClose(actual: number, expected: number, tolerance = 1): void {
  expect(
    Math.abs(actual - expected),
    `${actual} ≉ ${expected} (±${tolerance})`,
  ).toBeLessThanOrEqual(tolerance)
}

/** Number field of the transformation section by index: X Y W H. */
const TRANSFORM_LABELS = ['Position X', 'Position Y', 'Largeur', 'Hauteur'] as const

export function transformInput(page: Page, index: number) {
  return page.getByLabel(TRANSFORM_LABELS[index])
}
