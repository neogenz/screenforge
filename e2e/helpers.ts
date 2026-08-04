import { expect, type Download, type Page } from '@playwright/test'
import type { Canvas } from 'fabric'
import JSZip from 'jszip'
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
  oCoords?: Record<string, { x: number; y: number }>
  getCenterPoint?: () => { x: number; y: number }
}

declare global {
  interface Window {
    __sfCanvas?: Canvas
    __sfCrash?: () => void
    __sfStores?: {
      useHistoryStore: { getState: () => { past: unknown[]; future: unknown[] } }
      useCanvasStore: { getState: () => {
        layers: Layer[]
        selectedLayerIds: string[]
        activeScreenId: string
      } }
      useProjectStore: { getState: () => {
        project: Project | null
        updateScreenBackground: (screenId: string, background: Project['globals']['background']) => void
      } }
    }
  }
}

export async function waitForApp(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => window.__sfCanvas
    ?.getObjects()
    .some((object) => (object as DebugObject).data?.rendererType === 'background'))).toBe(true)
}

export async function addTextLayer(page: Page): Promise<void> {
  await page.locator('button[aria-label="Ajouter Texte"]').click()
  await page.waitForTimeout(300)
}

export async function addShapeLayer(page: Page): Promise<void> {
  await page.locator('button[aria-label="Ajouter Forme"]').click()
  await page.waitForTimeout(300)
}

export async function addDeviceLayer(page: Page): Promise<void> {
  await page.locator('button[aria-label="Ajouter un cadre iPhone"]').click()
  const model = page.getByRole('menuitem', { name: /iPhone 17 Pro Max/ })
  await expect(model).toBeVisible()
  await model.click()
  await expect.poll(() => page.evaluate(() => window.__sfStores
    ?.useCanvasStore.getState().layers.some((layer) => layer.type === 'device-frame'))).toBe(true)
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
  await page.locator('button[aria-label="Ajouter un écran"]').click()
  await page.waitForTimeout(600)
}

export function layerRows(page: Page) {
  return page.locator('[data-layer-id]')
}

export async function findObject(
  page: Page,
  rendererType: string,
): Promise<DebugObject | null> {
  return page.evaluate((type) => {
    const canvas = window.__sfCanvas
    const object = (canvas?.getObjects() as DebugObject[] | undefined)
      ?.find((candidate) => candidate.data?.rendererType === type)
    if (!object) return null
    return JSON.parse(JSON.stringify({
      data: object.data,
      left: object.left,
      top: object.top,
      angle: object.angle,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      type: object.type,
      visible: object.visible,
      text: object.text,
    })) as DebugObject
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

export async function dragControl(
  page: Page,
  name: string,
  dx: number,
  dy: number,
): Promise<void> {
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

export async function dragActiveBody(page: Page, dx: number, dy: number): Promise<void> {
  const center = await activeCenter(page)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + dx, center.y + dy, { steps: 12 })
  await page.mouse.up()
}

export function expectClose(actual: number, expected: number, tolerance = 1): void {
  expect(Math.abs(actual - expected), `${actual} ≉ ${expected} (±${tolerance})`).toBeLessThanOrEqual(tolerance)
}

/** Number field of the transformation section by index: X Y W H. */
const TRANSFORM_LABELS = ['Position X', 'Position Y', 'Largeur', 'Hauteur'] as const

export function transformInput(page: Page, index: number) {
  return page.getByLabel(TRANSFORM_LABELS[index])
}
