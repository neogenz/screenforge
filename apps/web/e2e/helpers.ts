import { expect, type Download, type Page, type Locator } from '@playwright/test'
import type { Canvas } from 'fabric'
import JSZip from 'jszip'
import type { Entitlements } from '../src/lib/entitlements'
import type { Theme } from '../src/lib/user-settings'
import type { SaveStatus, SyncStatus } from '../src/stores/ui.store'
import type { Layer, Project, StoreTargetId } from '../src/types'

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
  width?: number
  height?: number
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
          createProject: (name: string, target?: StoreTargetId) => void
          addScreen: () => string | null
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
          saveStatus: SaveStatus
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
      page.evaluate(() => {
        const project = window.__sfStores?.useProjectStore.getState().project
        return Boolean(
          project &&
          window.__sfCanvas
            ?.getObjects()
            .some(
              (object) =>
                (object as DebugObject).data?.rendererType === 'background' &&
                (object as DebugObject).data?.screenId === project.activeScreenId,
            ),
        )
      }),
    )
    .toBe(true)
}

export async function openAndroidProject(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.__sfStores?.useProjectStore.getState().createProject('Android', 'google-play-phone'),
  )
  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__sfStores?.useProjectStore.getState().project
        const background = window.__sfCanvas
          ?.getObjects()
          .find(
            (object) =>
              (object as DebugObject).data?.rendererType === 'background' &&
              (object as DebugObject).data?.screenId === project?.activeScreenId,
          )
        return {
          target: project?.target,
          width: (background as DebugObject | undefined)?.width,
          height: (background as DebugObject | undefined)?.height,
        }
      }),
    )
    .toEqual({ target: 'google-play-phone', width: 540, height: 960 })
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
  await page.locator('button[aria-label="Ajouter un appareil"]').click()
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

/** Le bouton qui porte les utilitaires : ils ne sont plus sur la rangée. */
export function utilitiesTrigger(page: Page) {
  return page.getByLabel('Ouvrir les autres actions')
}

/**
 * Ouvre un utilitaire — offre, compte, MCP, thème, palette.
 *
 * Ils vivent dans le menu « … » à toute largeur depuis que la barre haute
 * hiérarchise ses actions : composer et livrer sur la rangée, le reste ici.
 */
export async function openUtility(page: Page, name: string | RegExp): Promise<void> {
  await utilitiesTrigger(page).click()
  await page.getByRole('menuitem', { name }).click()
}

export function layerRows(page: Page) {
  return page.locator('[data-layer-id]')
}

/**
 * Ouvre un menu au clavier et focus l'entrée nommée, sans l'activer : à
 * l'appelant de presser Entrée ensuite, pour rester sur le même geste qu'un
 * contrôle ouvert directement (cf. `openWithKeyboard` dans dialogs-a11y).
 */
export async function openMenu(
  page: Page,
  trigger: Locator,
  itemName: string | RegExp,
): Promise<Locator> {
  await trigger.focus()
  await page.keyboard.press('Enter')
  const item = page.getByRole('menuitem', { name: itemName })
  await item.focus()
  return item
}

/**
 * Un seul anneau de focus, jamais deux superposés — le contour natif du
 * navigateur sur l'input caché d'une radio-card, par exemple, par-dessus
 * l'anneau 1px du label qui la porte. Place le focus par tabulation depuis
 * une sentinelle, vérifie le jeton `ring-ring` coss sur la boîte qui le
 * porte, et que le focus est bien `:focus-visible`.
 */
export async function expectOneFocusRing(page: Page, control: Locator): Promise<void> {
  await control.evaluate((element) => {
    const host =
      element instanceof HTMLInputElement && element.type === 'radio'
        ? element.closest('label')
        : element
    const sentinel = document.createElement('button')
    sentinel.type = 'button'
    sentinel.dataset.focusSentinel = ''
    sentinel.className = 'sr-only'
    host?.before(sentinel)
    sentinel.focus()
  })
  await page.keyboard.press('Tab')
  await expect(control).toBeFocused()
  expect(
    await control.evaluate((element) => {
      const host =
        element instanceof HTMLInputElement && element.type === 'radio'
          ? element.closest('label')
          : element
      return String(host?.className).includes('ring-ring')
    }),
  ).toBe(true)
  await expect
    .poll(() => control.evaluate((element) => element.matches(':focus-visible')))
    .toBe(true)
  await control.evaluate(() => document.querySelector('[data-focus-sentinel]')?.remove())
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

/**
 * Saisit une valeur dans un champ numérique coss. `fill` pose la valeur sans
 * passer par le clavier et Base UI, qui relit chaque frappe, la recolle
 * derrière l'ancienne ; on sélectionne tout et on tape.
 */
export async function fillNumber(field: Locator, text: string): Promise<void> {
  await field.click()
  await field.press('ControlOrMeta+a')
  await field.pressSequentially(text)
}

/**
 * Un contrôle ne peint rien hors de sa boîte.
 *
 * Une variante de taille coss déclare sa hauteur deux fois — `h-9 sm:h-8` — et
 * `cn()` indexe ses conflits par modificateur : un `h-auto` nu n'annule que la
 * moitié non préfixée, et au-delà de 640px le bouton reste figé pendant que son
 * contenu, centré, déborde des deux côtés. Même mécanique sur l'axe horizontal,
 * où `[&_svg:not([class*='size-'])]:size-4` recouvre la prop `size` de Lucide et
 * élargit une paire d'icônes au-delà de son carré. Les deux défauts sont muets :
 * la classe demandée est bien écrite, rien n'échoue à la compilation, et
 * `audit:scale` ne voit qu'une hauteur de plus, parfaitement légitime. Seule la
 * géométrie rendue distingue « ce bouton mesure 32px » de « ce bouton en peint
 * 60 dans 32 ».
 *
 * Mesuré sur la ligne du sélecteur de projets avant correctif : boîte de 43px,
 * contenu de 60px, le nom peint sur la ligne du dessus.
 */
export async function expectNoClippedControl(page: Page): Promise<void> {
  const clipped = await page.evaluate(() => {
    /* Débordements voulus, à déclarer ici plutôt qu'à affaiblir la mesure. */
    const ALLOWED = new Set<string>()
    const TOLERANCE = 1

    return [...document.querySelectorAll('[data-slot="button"], [data-slot="menu-trigger"]')]
      .filter((element) => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.height > 0
      })
      .map((element) => {
        const box = element.getBoundingClientRect()
        const name =
          element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 40) || '(vide)'
        /* Les enfants directs portent la mise en page ; les `svg` sont relus en
           propre car coss leur impose une taille que la prop de l'icône ne dit pas. */
        const parts = [...element.children, ...element.querySelectorAll('svg')]
        const spill = Math.max(
          0,
          ...parts.map((part) => {
            const rect = part.getBoundingClientRect()
            if (!(rect.width > 0 && rect.height > 0)) return 0
            return Math.max(
              box.top - rect.top,
              rect.bottom - box.bottom,
              box.left - rect.left,
              rect.right - box.right,
            )
          }),
        )
        return {
          name,
          box: `${String(Math.round(box.width))}×${String(Math.round(box.height))}`,
          spill: Math.round(spill),
        }
      })
      .filter((entry) => entry.spill > TOLERANCE && !ALLOWED.has(entry.name))
  })

  expect(clipped, 'des contrôles peignent hors de leur boîte').toEqual([])
}

/**
 * Aucune icône ne retombe sur la taille brute de Lucide.
 *
 * coss dimensionne chaque `svg` depuis son conteneur — `[&_svg:not([class*='size-'])]:size-4`
 * sur `Button`, `[&>svg]` sur `menu-item` — et gagne sur les attributs `width`/`height` que
 * la prop `size` de Lucide écrit. C'est pourquoi le projet ne déclare aucune taille
 * numérique. Mais rien ne dimensionne un `svg` hors d'un tel conteneur : aucune règle
 * globale n'existe, ni dans `index.css` ni dans `design-system/`. Une icône posée dans un
 * `div` nu rend donc ses 24px d'origine — 2,4 fois la taille voulue dans une ligne de 32,
 * et 8px de débord hors d'une pastille de 16.
 *
 * Le défaut est muet pour la garde d'à côté : `expectNoClippedControl` ne balaie que les
 * boutons, et ces icônes-là vivent dans des éléments ordinaires. Il l'est aussi pour
 * `audit:scale`, qui n'y lit qu'une taille de plus, parfaitement légitime. La signature est
 * en revanche exacte : 24×24 rendus sans classe `size-*` sur l'icône, c'est la valeur par
 * défaut de Lucide et rien d'autre — un conteneur coss ne produit jamais 24, et une icône
 * voulue à cette taille écrit `size-6`.
 *
 * Mesuré : quatre icônes dans cet état après le retrait des props numériques, toutes dans
 * des états que le balayage initial n'avait pas rendus — calque masqué ou verrouillé, étape
 * d'assistant terminée, dialogue derrière l'authentification, fin d'export.
 */
export async function expectNoRawIcon(page: Page): Promise<void> {
  const raw = await page.evaluate(() =>
    [...document.querySelectorAll('svg')]
      .filter((icon) => {
        const rect = icon.getBoundingClientRect()
        if (Math.round(rect.width) !== 24 || Math.round(rect.height) !== 24) return false
        /* `size-6` vaut 24 et se déclare : c'est une taille voulue, pas un repli. */
        return !/(^|\s)size-6(\s|$)/.test(icon.getAttribute('class') ?? '')
      })
      .map((icon) => {
        const host = icon.parentElement
        return {
          parent: (host?.getAttribute('class') ?? host?.tagName ?? '?').slice(0, 60),
          near: host?.textContent?.trim().slice(0, 30) || '(sans texte)',
        }
      }),
  )

  expect(raw, 'des icônes rendent les 24px bruts de Lucide').toEqual([])
}
