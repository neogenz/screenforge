import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActiveSelection,
  Canvas,
  FabricObject,
  Point,
  Rect,
  Shadow,
  Textbox,
  util,
} from 'fabric'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  applyLayerToFabricObject,
  applySelectionStyle,
  backgroundToFabricFill,
  clipContentToScreen,
  clipControlsToScreen,
  disposeFabricObjectResource,
  fabricObjectToLayerUpdate,
  getScreenOffset,
  getTotalWidth,
  layerToFabricObject,
  needsFabricObjectRecreation,
  type RenderedObject,
} from '@/components/canvas/canvas-utils'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { stageInsets } from '@/lib/stage'
import { computeSnap } from '@/lib/snapping'
import type { Box, Guide } from '@/lib/snapping'
import { DEFAULT_CANVAS_SHADOW_COLOR } from '@/lib/content-defaults'
import { applyLayerTransfer } from '@/lib/layer-transfer'
import type { LayoutLayerUpdate, LocalLayerTransfer } from '@/lib/layer-transfer'
import { isFontLoaded, loadGoogleFont } from '@/hooks/use-fonts'
import type { Layer, Project, Screen } from '@/types'

export { SCREEN_HEIGHT, SCREEN_WIDTH, getScreenOffset, getTotalWidth }

interface ChromeColors {
  label: string
  artboardRing: string
  activeRing: string
  selection: string
  selectionSoft: string
}

function readChromeColors(): ChromeColors {
  const styles = getComputedStyle(document.documentElement)
  const read = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback
  return {
    // Le libellé d'écran est posé sur le stage : `faint` y est trop faible.
    label: read('--color-foreground-muted', '#b8b8b8'),
    artboardRing: read('--color-artboard-ring', 'rgba(255,255,255,0.12)'),
    activeRing: read('--color-artboard-ring-active', 'rgba(255,255,255,0.5)'),
    selection: read('--color-selection', '#f7f7f7'),
    selectionSoft: read('--color-selection-soft', 'rgba(255,255,255,0.14)'),
  }
}

/**
 * Le lasso, lui, suit le thème : il est tracé sur le stage bien plus souvent
 * que sur un artboard. Le cadre des objets, à l'inverse, est toujours posé sur
 * le contenu de l'utilisateur — ses couleurs sont figées dans `canvas-utils`.
 */
function applyLassoColors(canvas: Canvas, chrome: ChromeColors): void {
  canvas.selectionColor = chrome.selectionSoft
  canvas.selectionBorderColor = chrome.selection
  canvas.selectionLineWidth = 1
}

/** Distance d'accroche, en pixels d'écran : c'est ce que l'œil juge, pas les unités canvas. */
const SNAP_DISTANCE_PX = 6

/**
 * Les repères sont tracés sur le contenu de l'utilisateur, jamais sur le
 * chrome : leur couleur ne suit donc pas le thème. Un magenta saturé — la
 * convention de tous les éditeurs de maquette — reste lisible sur à peu près
 * n'importe quel artboard et n'existe nulle part ailleurs dans l'interface.
 */
const GUIDE_COLOR = '#ff2d6f'

/**
 * `getBoundingRect` lit `aCoords`, que Fabric ne rafraîchit qu'à la fin d'une
 * action de transformation — donc après avoir émis `object:moving`. Sans ce
 * `setCoords`, l'accroche raisonnait sur la position d'avant le mouvement et
 * ne se déclenchait jamais.
 */
function boxOf(object: FabricObject): Box {
  object.setCoords()
  const { left, top, width, height } = object.getBoundingRect()
  return { left, top, width, height }
}

/**
 * Ce sur quoi le calque en cours de déplacement peut s'accrocher : les bords et
 * le centre de son artboard, puis ceux des autres calques de la même planche.
 * L'artboard vient en tête — à égalité de distance, ses repères l'emportent.
 *
 * Calculé une fois par geste : le recalculer à chaque frame ferait un
 * `getBoundingRect` par objet et par mouvement de souris.
 */
function collectSnapTargets(canvas: Canvas, moving: FabricObject): Box[] {
  const members = new Set<FabricObject>(
    moving instanceof ActiveSelection ? moving.getObjects() : [moving],
  )
  const screenIndex = [...members]
    .map((member) => (member as RenderedObject).data?.screenIndex)
    .find((index) => index !== undefined) ?? 0

  const targets: Box[] = [
    { left: getScreenOffset(screenIndex), top: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  ]
  for (const object of canvas.getObjects() as RenderedObject[]) {
    if (members.has(object) || object.data?.screenIndex !== screenIndex) continue
    if (object.data?.rendererType === 'background' || object.data?.rendererType === 'label') continue
    if (!object.visible) continue
    targets.push(boxOf(object))
  }
  return targets
}

function screenIndexAtPoint(screens: Screen[], point: { x: number; y: number }): number | null {
  if (point.y < 0 || point.y > SCREEN_HEIGHT) return null
  const index = screens.findIndex((_, screenIndex) => {
    const left = getScreenOffset(screenIndex)
    return point.x >= left && point.x <= left + SCREEN_WIDTH
  })
  return index === -1 ? null : index
}

function drawGuides(canvas: Canvas, guides: Guide[]): void {
  const ctx = canvas.contextTop
  const retina = canvas.getRetinaScaling()
  const [zoomX, , , zoomY, panX, panY] = canvas.viewportTransform
  ctx.save()
  ctx.setTransform(retina, 0, 0, retina, 0, 0)
  ctx.strokeStyle = GUIDE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const guide of guides) {
    // Le demi-pixel place le trait sur la grille : sans lui un hairline se
    // dédouble sur deux colonnes et paraît flou.
    if (guide.axis === 'x') {
      const x = Math.round(guide.position * zoomX + panX) + 0.5
      ctx.moveTo(x, guide.from * zoomY + panY)
      ctx.lineTo(x, guide.to * zoomY + panY)
    } else {
      const y = Math.round(guide.position * zoomY + panY) + 0.5
      ctx.moveTo(guide.from * zoomX + panX, y)
      ctx.lineTo(guide.to * zoomX + panX, y)
    }
  }
  ctx.stroke()
  ctx.restore()
  // Fabric efface `contextTop` au rendu suivant quand ce drapeau est levé :
  // c'est ce qui nettoie les repères de la frame précédente.
  canvas.contextTopDirty = true
}

/** Boîte de la sélection en pixels du conteneur, pour poser la barre contextuelle. */
export interface SelectionFrame {
  left: number
  top: number
  width: number
  height: number
  /** Le canvas occupe tout le conteneur : ses dimensions bornent la barre. */
  stageWidth: number
  stageHeight: number
}

function readSelectionFrame(canvas: Canvas): SelectionFrame | null {
  const active = canvas.getActiveObject() as RenderedObject | null
  if (!active) return null
  active.setCoords()
  const bounds = active.getBoundingRect()
  let left = bounds.left
  let right = bounds.left + bounds.width
  // L'instance d'un calque partagé déborde de sa planche : la barre doit se
  // poser sous la tranche que l'utilisateur voit, pas au milieu d'une gouttière.
  const screenIndex = active.data?.screenIndex
  if (screenIndex !== undefined) {
    left = Math.max(left, getScreenOffset(screenIndex))
    right = Math.min(right, getScreenOffset(screenIndex) + SCREEN_WIDTH)
  }
  if (right <= left) return null
  const [zoomX, , , zoomY, panX, panY] = canvas.viewportTransform
  return {
    left: left * zoomX + panX,
    top: bounds.top * zoomY + panY,
    width: (right - left) * zoomX,
    height: bounds.height * zoomY,
    stageWidth: canvas.getWidth(),
    stageHeight: canvas.getHeight(),
  }
}

function sameFrame(left: SelectionFrame | null, right: SelectionFrame | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return Math.round(left.left) === Math.round(right.left)
    && Math.round(left.top) === Math.round(right.top)
    && Math.round(left.width) === Math.round(right.width)
    && Math.round(left.height) === Math.round(right.height)
    && left.stageWidth === right.stageWidth
    && left.stageHeight === right.stageHeight
}

/** En deçà, la tranche visible est un liseré : rien qu'on puisse viser. */
const MIN_GRABBABLE = 8

/**
 * La tranche de ce calque tombe-t-elle dans la fenêtre de sa planche ? Un
 * panorama n'est visible que sur les planches qu'il traverse ; ailleurs son
 * instance est entièrement écrêtée et ne doit pas se laisser attraper.
 */
function intersectsScreen(object: RenderedObject, screenIndex: number): boolean {
  const bounds = object.getBoundingRect()
  const windowLeft = getScreenOffset(screenIndex)
  const overlapX = Math.min(bounds.left + bounds.width, windowLeft + SCREEN_WIDTH)
    - Math.max(bounds.left, windowLeft)
  const overlapY = Math.min(bounds.top + bounds.height, SCREEN_HEIGHT) - Math.max(bounds.top, 0)
  return overlapX > MIN_GRABBABLE && overlapY > MIN_GRABBABLE
}

/**
 * Rattache un objet à la fenêtre de sa planche : le contenu et la sélection
 * par le même écrêtage. Les deux vont ensemble — un cadre plus large que ce
 * qui est dessiné se lit comme un sélecteur cassé.
 *
 * L'écrêtage ne dépend que de l'indice, et poser les deux enveloppes coûte
 * deux fermetures : le marqueur évite de les refaire à chaque synchronisation.
 */
function ensureScreenClipPath(object: RenderedObject, screenIndex: number): void {
  if (object.data?.clipScreenIndex === screenIndex) return
  clipContentToScreen(object, screenIndex)
  clipControlsToScreen(object, screenIndex)
  object.set('data', { ...object.data, clipScreenIndex: screenIndex })
}

/**
 * Pose l'instance d'un calque partagé sur sa planche. Le calque vit dans un
 * espace continu qui ignore les gouttières : chaque planche en montre la
 * tranche qui la traverse, d'où le décalage des seules gouttières cumulées.
 * Les deux chemins de synchronisation passent ici, sinon un déplacement en
 * patch laisse la prise réglée sur la position précédente.
 */
function applyLayoutInstance(
  object: RenderedObject,
  layer: Layer,
  screenIndex: number,
): void {
  applyLayerToFabricObject(object, layer, getScreenOffset(screenIndex) - screenIndex * SCREEN_WIDTH)
  ensureScreenClipPath(object, screenIndex)
  // Seule une tranche réellement visible se laisse attraper. Réserver la prise
  // à la planche active donnait des poignées posées sur du vide, à côté de la
  // tranche que l'utilisateur voit.
  const visible = intersectsScreen(object, screenIndex)
  object.set({ selectable: !layer.locked && visible, evented: !layer.locked && visible })
}

function screensHaveVisualChanges(current: Project, previous: Project | null): boolean {
  if (!previous || current.screens.length !== previous.screens.length) return true
  if (current.layoutLayers !== previous.layoutLayers
    || current.activeScreenId !== previous.activeScreenId) return true
  return current.screens.some((screen, index) => {
    const previousScreen = previous.screens[index]
    return screen.id !== previousScreen.id
      || screen.name !== previousScreen.name
      || screen.layers !== previousScreen.layers
      || screen.background !== previousScreen.background
  })
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

type ProjectChange =
  | { type: 'none' }
  | { type: 'full' }
  | {
      type: 'patch'
      screenId: string
      layerIds: string[]
      layoutLayerIds: string[]
      backgroundChanged: boolean
    }

function layerOrderKey(layers: Layer[]): string {
  return layers.map((layer) => `${layer.id}:${layer.zIndex}`).join('|')
}

function changedLayerIds(current: Layer[], previous: Layer[]): string[] | null {
  if (current.length !== previous.length) return null
  if (layerOrderKey(current) !== layerOrderKey(previous)) return null
  const ids: string[] = []
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== previous[index]) ids.push(current[index].id)
  }
  return ids
}

/**
 * Reference-level diff between two project states. 'patch' means: one
 * screen, same object set and stacking order — only some layer objects and/or
 * the background changed, so the canvas can be patched in place instead of
 * running a full reconciliation pass.
 */
function diffProjectChange(current: Project, previous: Project | null): ProjectChange {
  if (!previous) return { type: 'full' }
  if (!screensHaveVisualChanges(current, previous)) return { type: 'none' }
  if (current.screens.length !== previous.screens.length) return { type: 'full' }
  if (current.activeScreenId !== previous.activeScreenId) return { type: 'full' }

  let layoutLayerIds: string[] = []
  if (current.layoutLayers !== previous.layoutLayers) {
    const changed = changedLayerIds(current.layoutLayers, previous.layoutLayers)
    if (!changed) return { type: 'full' }
    layoutLayerIds = changed
  }

  const changedScreens: { screen: Screen; previousScreen: Screen }[] = []
  for (let index = 0; index < current.screens.length; index += 1) {
    const screen = current.screens[index]
    const previousScreen = previous.screens[index]
    if (screen.id !== previousScreen.id) return { type: 'full' }
    if (screen === previousScreen) continue
    if (screen.name !== previousScreen.name) return { type: 'full' }
    if (screen.layers !== previousScreen.layers || screen.background !== previousScreen.background) {
      changedScreens.push({ screen, previousScreen })
    }
  }

  if (changedScreens.length > 1) return { type: 'full' }
  if (changedScreens.length === 0) {
    return layoutLayerIds.length > 0
      ? {
          type: 'patch',
          screenId: current.activeScreenId,
          layerIds: [],
          layoutLayerIds,
          backgroundChanged: false,
        }
      : { type: 'none' }
  }

  const { screen, previousScreen } = changedScreens[0]
  const layerIds = screen.layers === previousScreen.layers
    ? []
    : changedLayerIds(screen.layers, previousScreen.layers)
  if (!layerIds) return { type: 'full' }
  const backgroundChanged = screen.background !== previousScreen.background

  if (layerIds.length === 0 && layoutLayerIds.length === 0 && !backgroundChanged) {
    return { type: 'none' }
  }
  return { type: 'patch', screenId: screen.id, layerIds, layoutLayerIds, backgroundChanged }
}

/**
 * Maps store selection to canvas objects. A shared (layout) layer resolves to
 * its active-screen instance only: each instance is a full clipped clone, so
 * wrapping the panorama union in one ActiveSelection produced a giant
 * misaligned control box — and rotating/scaling that union wrote back garbage.
 */
function resolveSelectionObjects(
  project: Project,
  objectsById: Map<string, RenderedObject>,
  selectedIds: string[],
): RenderedObject[] {
  return selectedIds.flatMap((id) => {
    const object = objectsById.get(id)
      ?? objectsById.get(`layout:${id}:${project.activeScreenId}`)
    return object ? [object] : []
  })
}

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const syncing = useRef(false)
  const syncVersion = useRef(0)
  const ignoreSelectionCleared = useRef(false)
  const panning = useRef(false)
  const interacting = useRef(false)
  const applyingStoreSelection = useRef(false)
  const panPoint = useRef<{ x: number; y: number } | null>(null)
  const selectionFromCanvas = useRef(false)
  const thumbnailTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thumbnailGeneration = useRef(0)
  const fontLoadRequests = useRef(new Set<string>())
  const layoutInstances = useRef(new Map<string, RenderedObject[]>())
  const wheelRenderQueued = useRef(false)
  const publishedFrame = useRef<SelectionFrame | null>(null)
  const [selectionFrame, setSelectionFrame] = useState<SelectionFrame | null>(null)
  const setZoom = useUIStore((state) => state.setZoom)

  const generateThumbnails = useCallback((screens: Screen[]) => {
    if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current)
    const generation = ++thumbnailGeneration.current

    thumbnailTimer.current = setTimeout(() => {
      // The capture pass mutates the viewport and forces two renders — keep
      // it off the interaction critical path.
      const scheduleIdle: (task: () => void) => void =
        typeof requestIdleCallback === 'function'
          ? (task) => requestIdleCallback(() => task(), { timeout: 1200 })
          : (task) => setTimeout(task, 0)
      scheduleIdle(() => {
      const canvas = fabricRef.current
      if (!canvas || generation !== thumbnailGeneration.current) return
      const backgrounds = (canvas.getObjects() as RenderedObject[]).filter(
        (object) => object.data?.rendererType === 'background',
      )
      if (backgrounds.length === 0) return

      const savedViewport = [...canvas.viewportTransform] as typeof canvas.viewportTransform
      const thumbnails: Record<string, string> = {}

      try {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const background of backgrounds) {
          const { tl, br } = background.aCoords
          minX = Math.min(minX, tl.x)
          minY = Math.min(minY, tl.y)
          maxX = Math.max(maxX, br.x)
          maxY = Math.max(maxY, br.y)
        }

        const contentWidth = maxX - minX
        const contentHeight = maxY - minY
        const padding = 20
        const fitZoom = Math.min(
          (canvas.width - padding * 2) / contentWidth,
          (canvas.height - padding * 2) / contentHeight,
          1,
        )
        const panX = (canvas.width - contentWidth * fitZoom) / 2 - minX * fitZoom
        const panY = (canvas.height - contentHeight * fitZoom) / 2 - minY * fitZoom
        canvas.setViewportTransform([fitZoom, 0, 0, fitZoom, panX, panY])
        canvas.renderAll()

        const source = canvas.lowerCanvasEl
        const retinaScale = canvas.getRetinaScaling()
        const thumbnailWidth = Math.round(SCREEN_WIDTH * 0.2)
        const thumbnailHeight = Math.round(SCREEN_HEIGHT * 0.2)

        for (const screen of screens) {
          if (generation !== thumbnailGeneration.current) return
          const background = backgrounds.find(
            (object) => object.data?.uid === `background:${screen.id}`,
          )
          if (!background) continue
          const { tl, br } = background.aCoords
          const crop = document.createElement('canvas')
          crop.width = thumbnailWidth
          crop.height = thumbnailHeight
          const context = crop.getContext('2d')
          if (!context) continue
          context.drawImage(
            source,
            (tl.x * fitZoom + panX) * retinaScale,
            (tl.y * fitZoom + panY) * retinaScale,
            (br.x - tl.x) * fitZoom * retinaScale,
            (br.y - tl.y) * fitZoom * retinaScale,
            0,
            0,
            thumbnailWidth,
            thumbnailHeight,
          )
          thumbnails[screen.id] = crop.toDataURL('image/png')
        }
      } catch (error) {
        console.error('Could not generate screen thumbnails.', error)
      } finally {
        canvas.setViewportTransform(savedViewport)
        canvas.renderAll()
      }

      if (generation !== thumbnailGeneration.current) return
      const project = useProjectStore.getState().project
      if (!project) return
      const updatedScreens = project.screens.map((screen) => {
        const thumbnail = thumbnails[screen.id]
        return thumbnail && thumbnail !== screen.thumbnail
          ? { ...screen, thumbnail }
          : screen
      })
      if (updatedScreens.some((screen, index) => screen !== project.screens[index])) {
        useProjectStore.setState({
          project: { ...project, screens: updatedScreens },
        })
      }
      })
    }, 300)
  }, [])

  const fitAll = useCallback((canvas: Canvas, screenCount: number) => {
    const { layersOpen, propsOpen } = useUIStore.getState()
    const insets = stageInsets({ layers: layersOpen, props: propsOpen })
    const availableWidth = Math.max(1, canvas.width - insets.left - insets.right)
    const availableHeight = Math.max(1, canvas.height - insets.top - insets.bottom)
    const totalWidth = getTotalWidth(screenCount)
    const padding = 48
    const zoom = Math.min(
      (availableWidth - padding * 2) / totalWidth,
      (availableHeight - padding * 2) / SCREEN_HEIGHT,
      1,
    )
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      insets.left + (availableWidth - totalWidth * zoom) / 2,
      insets.top + (availableHeight - SCREEN_HEIGHT * zoom) / 2,
    ])
    setZoom(zoom)
  }, [setZoom])

  /**
   * Resolves the store layer under a native pointer event, for the on-canvas
   * context menu. Layout instances expose their shared `layerId`; chrome
   * objects (background, label) are not evented and never match.
   */
  const getLayerIdAtPoint = useCallback((event: MouseEvent): string | null => {
    const canvas = fabricRef.current
    if (!canvas) return null
    const target = canvas.findTarget(event)?.target as RenderedObject | undefined
    const data = target?.data
    if (data) {
      const id = data.layerId ?? data.uid
      if (id) return id
    }
    // Click inside an active multi-selection: keep it and target any member.
    const selected = useCanvasStore.getState().selectedLayerIds
    if (target instanceof ActiveSelection) return selected[0] ?? null
    return null
  }, [])

  const sync = useCallback(async (project: Project) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const { screens, layoutLayers, activeScreenId } = project
    const chrome = readChromeColors()
    applyLassoColors(canvas, chrome)
    const version = ++syncVersion.current
    syncing.current = true

    try {
      const existingObjects = canvas.getObjects() as RenderedObject[]
      const objectsById = new Map<string, RenderedObject>()
      for (const object of existingObjects) {
        const id = object.data?.uid
        if (!id) continue
        const duplicate = objectsById.get(id)
        if (duplicate) {
          canvas.remove(object)
          disposeFabricObjectResource(object)
        } else {
          objectsById.set(id, object)
        }
      }

      const wantedIds = new Set<string>()
      for (const screen of screens) {
        wantedIds.add(`background:${screen.id}`)
        wantedIds.add(`label:${screen.id}`)
        for (const layer of screen.layers) wantedIds.add(layer.id)
        for (const layer of layoutLayers) wantedIds.add(`layout:${layer.id}:${screen.id}`)
      }
      for (const [id, object] of objectsById) {
        if (wantedIds.has(id)) continue
        canvas.remove(object)
        disposeFabricObjectResource(object)
        objectsById.delete(id)
      }

      for (let screenIndex = 0; screenIndex < screens.length; screenIndex += 1) {
        const screen = screens[screenIndex]
        const offset = getScreenOffset(screenIndex)
        const backgroundId = `background:${screen.id}`
        let background = objectsById.get(backgroundId)
        if (!background) {
          background = new Rect({
            originX: 'left',
            originY: 'top',
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            selectable: false,
            evented: false,
            strokeUniform: true,
            shadow: new Shadow({ color: DEFAULT_CANVAS_SHADOW_COLOR, blur: 24, offsetY: 4 }),
          })
          background.set('data', {
            uid: backgroundId,
            screenId: screen.id,
            rendererType: 'background',
          })
          canvas.add(background)
          objectsById.set(backgroundId, background)
        }
        background.set({
          left: offset,
          top: 0,
          fill: backgroundToFabricFill(screen.background),
          stroke: screen.id === activeScreenId ? chrome.activeRing : chrome.artboardRing,
          strokeWidth: screen.id === activeScreenId ? 2 : 1,
        })
        background.setCoords()

        const labelId = `label:${screen.id}`
        let label = objectsById.get(labelId)
        if (!label) {
          label = new Textbox('', {
            originX: 'left',
            originY: 'top',
            width: SCREEN_WIDTH,
            fontSize: 12,
            // Même famille que l'interface. Archivo n'est plus chargée depuis la v3 :
            // le libellé retombait sur system-ui et détonnait avec le reste.
            fontFamily: 'Inter, system-ui, sans-serif',
            selectable: false,
            evented: false,
          })
          label.set('data', {
            uid: labelId,
            screenId: screen.id,
            rendererType: 'label',
          })
          canvas.add(label)
          objectsById.set(labelId, label)
        }
        label.set({ left: offset, top: -26, text: screen.name, fill: chrome.label })
        label.setCoords()

        for (const layer of screen.layers) {
          if (layer.type === 'text' && !isFontLoaded(layer.fontFamily)) {
            const fontKey = `${layer.fontFamily}:${layer.fontWeight}`
            if (!fontLoadRequests.current.has(fontKey)) {
              fontLoadRequests.current.add(fontKey)
              void loadGoogleFont(layer.fontFamily, [String(layer.fontWeight)]).then((result) => {
                if (result.status !== 'loaded') return
                const latestCanvas = fabricRef.current
                if (!latestCanvas) return
                const textObject = (latestCanvas.getObjects() as RenderedObject[]).find(
                  (candidate) => candidate.data?.uid === layer.id,
                )
                if (textObject instanceof Textbox) textObject.initDimensions()
                textObject?.setCoords()
                latestCanvas.requestRenderAll()
              })
            }
          }
          let object = objectsById.get(layer.id)
          if (object && needsFabricObjectRecreation(object, layer)) {
            const replacement = await layerToFabricObject(layer)
            if (syncVersion.current !== version) {
              disposeFabricObjectResource(replacement)
              return
            }
            canvas.remove(object)
            disposeFabricObjectResource(object)
            object = replacement
            canvas.add(object)
            objectsById.set(layer.id, object)
          } else if (!object) {
            object = await layerToFabricObject(layer)
            if (syncVersion.current !== version) {
              disposeFabricObjectResource(object)
              return
            }
            canvas.add(object)
            objectsById.set(layer.id, object)
          }

          object.set('data', {
            ...object.data,
            uid: layer.id,
            layerId: layer.id,
            screenId: screen.id,
            screenIndex,
            layout: false,
            rendererType: layer.type,
          })
          applyLayerToFabricObject(object, layer, offset)
          ensureScreenClipPath(object, screenIndex)
        }
      }

      for (const layer of layoutLayers) {
        if (layer.type === 'text' && !isFontLoaded(layer.fontFamily)) {
          const fontKey = `${layer.fontFamily}:${layer.fontWeight}`
          if (!fontLoadRequests.current.has(fontKey)) {
            fontLoadRequests.current.add(fontKey)
            void loadGoogleFont(layer.fontFamily, [String(layer.fontWeight)]).then((result) => {
              if (result.status !== 'loaded') return
              const latestCanvas = fabricRef.current
              if (!latestCanvas) return
              for (const textObject of latestCanvas.getObjects() as RenderedObject[]) {
                if (textObject.data?.layerId !== layer.id) continue
                if (textObject instanceof Textbox) textObject.initDimensions()
                textObject.setCoords()
              }
              latestCanvas.requestRenderAll()
            })
          }
        }

        for (let screenIndex = 0; screenIndex < screens.length; screenIndex += 1) {
          const screen = screens[screenIndex]
          const objectId = `layout:${layer.id}:${screen.id}`
          let object = objectsById.get(objectId)
          if (object && needsFabricObjectRecreation(object, layer)) {
            const replacement = await layerToFabricObject(layer)
            if (syncVersion.current !== version) {
              disposeFabricObjectResource(replacement)
              return
            }
            canvas.remove(object)
            disposeFabricObjectResource(object)
            object = replacement
            canvas.add(object)
            objectsById.set(objectId, object)
          } else if (!object) {
            object = await layerToFabricObject(layer)
            if (syncVersion.current !== version) {
              disposeFabricObjectResource(object)
              return
            }
            canvas.add(object)
            objectsById.set(objectId, object)
          }

          object.set('data', {
            ...object.data,
            uid: objectId,
            layerId: layer.id,
            screenId: screen.id,
            screenIndex,
            layout: true,
            rendererType: layer.type,
          })
          applyLayoutInstance(object, layer, screenIndex)
        }
      }

      const orderedObjects: RenderedObject[] = []
      for (const screen of screens) {
        const background = objectsById.get(`background:${screen.id}`)
        if (background) orderedObjects.push(background)
      }
      for (const screen of screens) {
        const layers = [...screen.layers, ...layoutLayers]
          .sort((left, right) => left.zIndex - right.zIndex)
        for (const layer of layers) {
          const object = layer.scope === 'layout'
            ? objectsById.get(`layout:${layer.id}:${screen.id}`)
            : objectsById.get(layer.id)
          if (object) orderedObjects.push(object)
        }
      }
      for (const screen of screens) {
        const label = objectsById.get(`label:${screen.id}`)
        if (label) orderedObjects.push(label)
      }
      // Z-order: only pay the moveObjectTo pass when the order actually changed.
      const wantedOrder = orderedObjects.map((object) => object.data?.uid ?? '')
      const currentOrder = (canvas.getObjects() as RenderedObject[])
        .map((object) => object.data?.uid ?? '')
      if (!sameIds(currentOrder, wantedOrder)) {
        orderedObjects.forEach((object, index) => canvas.moveObjectTo(object, index))
      }

      // Precomputed layout echoes for the object:moving mirror (no per-move scan).
      const instances = new Map<string, RenderedObject[]>()
      for (const layer of layoutLayers) {
        instances.set(layer.id, screens.flatMap((screen) => {
          const object = objectsById.get(`layout:${layer.id}:${screen.id}`)
          return object ? [object] : []
        }))
      }
      layoutInstances.current = instances

      const selectedIds = useCanvasStore.getState().selectedLayerIds
      const currentSelectionIds = canvas.getActiveObjects()
        .map((object) => {
          const data = (object as RenderedObject).data
          return data?.layerId ?? data?.uid
        })
        .filter((id): id is string => Boolean(id))
      const uniqueCurrentIds = [...new Set(currentSelectionIds)]
      if (!sameIds(uniqueCurrentIds, selectedIds)) {
        const selectedObjects = resolveSelectionObjects(project, objectsById, selectedIds)
        if (selectedObjects.length === 0) canvas.discardActiveObject()
        else if (selectedObjects.length === 1) canvas.setActiveObject(selectedObjects[0])
        else canvas.setActiveObject(new ActiveSelection(selectedObjects, { canvas }))
      }

      canvas.requestRenderAll()
      generateThumbnails(screens)
    } catch (error) {
      console.error('Could not synchronize the canvas.', error)
    } finally {
      if (syncVersion.current === version) {
        requestAnimationFrame(() => {
          syncing.current = false
        })
      }
    }
  }, [generateThumbnails])

  /**
   * In-place patch path for single-screen, same-stacking-order changes
   * (the hot path: panel edits, keyboard nudges, canvas transform commits).
   * Returns false when the change cannot be patched — caller falls back to
   * a full sync.
   */
  const syncPatch = useCallback(async (
    project: Project,
    change: {
      screenId: string
      layerIds: string[]
      layoutLayerIds: string[]
      backgroundChanged: boolean
    },
  ): Promise<boolean> => {
    const canvas = fabricRef.current
    if (!canvas) return false
    const objectsById = new Map<string, RenderedObject>()
    for (const object of canvas.getObjects() as RenderedObject[]) {
      const id = object.data?.uid
      if (id) objectsById.set(id, object)
    }

    if (change.backgroundChanged) {
      const screen = project.screens.find((candidate) => candidate.id === change.screenId)
      const background = objectsById.get(`background:${change.screenId}`)
      if (!screen || !background) return false
      background.set({ fill: backgroundToFabricFill(screen.background) })
      background.setCoords()
    }

    const screenIndex = project.screens.findIndex((screen) => screen.id === change.screenId)
    if (screenIndex === -1 && change.layerIds.length > 0) return false
    const screen = project.screens[screenIndex]

    for (const layerId of change.layerIds) {
      const layer = screen.layers.find((candidate) => candidate.id === layerId)
      const object = objectsById.get(layerId)
      if (!layer || !object) return false
      if (needsFabricObjectRecreation(object, layer)) return false
      if (layer.type === 'text' && !isFontLoaded(layer.fontFamily)) return false
      applyLayerToFabricObject(object, layer, getScreenOffset(screenIndex))
    }

    for (const layerId of change.layoutLayerIds) {
      const layer = project.layoutLayers.find((candidate) => candidate.id === layerId)
      if (!layer) return false
      if (layer.type === 'text' && !isFontLoaded(layer.fontFamily)) return false
      for (let index = 0; index < project.screens.length; index += 1) {
        const object = objectsById.get(`layout:${layerId}:${project.screens[index].id}`)
        if (!object) return false
        if (needsFabricObjectRecreation(object, layer)) return false
        applyLayoutInstance(object, layer, index)
      }
    }

    canvas.requestRenderAll()
    generateThumbnails(project.screens)
    return true
  }, [generateThumbnails])

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const container = containerRef.current
    const bounds = container.getBoundingClientRect()
    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: 'transparent',
      width: Math.max(1, Math.floor(bounds.width)),
      height: Math.max(1, Math.floor(bounds.height)),
      selection: true,
      preserveObjectStacking: true,
      // Let contextmenu events bubble to React — CanvasEditor renders its own menu.
      stopContextMenu: false,
    })
    fabricRef.current = canvas
    if (import.meta.env.DEV) {
      const dbg = window as unknown as { __sfCanvas?: Canvas; __sfFabric?: unknown }
      dbg.__sfCanvas = canvas
      dbg.__sfFabric = { Rect, ActiveSelection, Point, util }
    }

    const dragSourceScreenIndexes = new Map<RenderedObject, number>()

    canvas.on('object:modified', (event) => {
      if (syncing.current || !event.target) return
      const target = event.target
      const objects = target instanceof ActiveSelection
        ? target.getObjects() as RenderedObject[]
        : [target as RenderedObject]
      const project = useProjectStore.getState().project
      if (!project) return
      // On group transforms of a shared layer, every instance writes the same
      // layerId — the active screen's instance is authoritative (processed last).
      objects.sort((a, b) =>
        Number(a.data?.screenId === project.activeScreenId)
        - Number(b.data?.screenId === project.activeScreenId))

      const dropScreenIndex = event.action === 'drag'
        ? screenIndexAtPoint(project.screens, target.getCenterPoint())
        : null
      const localUpdates: LocalLayerTransfer[] = []
      const layoutUpdates: LayoutLayerUpdate[] = []
      for (const object of objects) {
        const layerId = object.data?.layerId ?? object.data?.uid
        const screenId = object.data?.screenId
        if (!layerId || !screenId) continue
        const screenIndex = project.screens.findIndex((screen) => screen.id === screenId)
        if (screenIndex === -1) continue
        if (object.data?.layout) {
          layoutUpdates.push({
            layerId,
            update: fabricObjectToLayerUpdate(
              object,
              getScreenOffset(screenIndex) - screenIndex * SCREEN_WIDTH,
            ) as Partial<Layer>,
          })
          continue
        }
        const sourceScreenIndex = dragSourceScreenIndexes.get(object) ?? screenIndex
        const targetScreenIndex = dropScreenIndex ?? sourceScreenIndex
        const targetScreen = project.screens[targetScreenIndex]
        const layer = project.screens[screenIndex].layers.find((candidate) => candidate.id === layerId)
        if (!targetScreen || !layer) continue
        if (dropScreenIndex === null && object.data?.screenIndex !== sourceScreenIndex) {
          object.set('data', { ...object.data, screenIndex: sourceScreenIndex })
          ensureScreenClipPath(object, sourceScreenIndex)
        }
        localUpdates.push({
          layer,
          sourceScreenId: screenId,
          targetScreenId: targetScreen.id,
          update: fabricObjectToLayerUpdate(
            object,
            getScreenOffset(targetScreenIndex),
          ) as Partial<Layer>,
        })
      }
      if (localUpdates.length === 0 && layoutUpdates.length === 0) return

      const transfer = localUpdates.find((change) =>
        change.sourceScreenId !== change.targetScreenId)
      const affectedScreenIds = new Set(localUpdates.flatMap((change) => [
        change.sourceScreenId,
        change.targetScreenId,
      ]))
      const changesProjectLayout = layoutUpdates.length > 0
        || Boolean(transfer)
        || affectedScreenIds.size > 1
      if (changesProjectLayout) useCanvasStore.getState().recordProjectHistory()
      else useCanvasStore.getState().recordHistory()

      if (target instanceof ActiveSelection) {
        // The discard fires selection:cleared synchronously — the store must
        // keep the selection so the upcoming sync can re-apply it.
        ignoreSelectionCleared.current = true
        canvas.discardActiveObject()
        queueMicrotask(() => {
          ignoreSelectionCleared.current = false
        })
      }

      const next = applyLayerTransfer({
        screens: project.screens,
        layoutLayers: project.layoutLayers,
        localTransfers: localUpdates,
        layoutUpdates,
      })
      const destinationScreenId = next.destinationScreenId
      useProjectStore.setState({
        project: {
          ...project,
          activeScreenId: destinationScreenId ?? project.activeScreenId,
          screens: next.screens,
          layoutLayers: next.layoutLayers,
          updatedAt: Math.max(Date.now(), project.updatedAt + 1),
        },
      })
      const canvasStore = useCanvasStore.getState()
      if (destinationScreenId) {
        const selectedIds = [...new Set(objects.flatMap((object) => {
          const id = object.data?.layerId ?? object.data?.uid
          return id ? [id] : []
        }))]
        if (destinationScreenId !== canvasStore.activeScreenId) {
          selectionFromCanvas.current = true
        }
        canvasStore.setActiveScreenId(destinationScreenId)
        useCanvasStore.getState().selectLayers(selectedIds)
      } else {
        canvasStore.syncLayersFromProject()
      }
      dragSourceScreenIndexes.clear()
    })

    /**
     * Un texte déjà sélectionné annonce l'édition en place ; au repos il annonce
     * le déplacement, qui est ce qu'un premier clic fait vraiment. Un curseur
     * `text` posé en permanence promettrait une sélection de caractères que le
     * premier clic refuse.
     */
    function syncTextCursors() {
      const active = new Set(canvas.getActiveObjects())
      for (const object of canvas.getObjects() as RenderedObject[]) {
        if (object.data?.rendererType !== 'text' || !object.selectable) continue
        object.hoverCursor = active.has(object) ? 'text' : 'move'
      }
    }

    function handleSelection() {
      syncTextCursors()
      if (syncing.current || applyingStoreSelection.current) return
      // `selection:updated` only reports the delta — read the full selection.
      const renderedObjects = canvas.getActiveObjects() as RenderedObject[]
      const ids = [...new Set(renderedObjects.flatMap((object) => {
        const id = object.data?.layerId ?? object.data?.uid
        return id ? [id] : []
      }))]
      const screenId = renderedObjects.find((object) => object.data?.screenId)?.data?.screenId
      if (screenId && screenId !== useCanvasStore.getState().activeScreenId) {
        selectionFromCanvas.current = true
        useCanvasStore.getState().setActiveScreenId(screenId)
      }
      if (ids.length === 1) {
        useCanvasStore.getState().selectLayer(ids[0])
      } else if (ids.length > 1) {
        useCanvasStore.getState().selectLayers(ids)
      }
    }

    // Store → canvas selection. A single shared layer resolves to every screen
    // instance it spans, so the control box matches the clipped panorama
    // rendering exactly. Never called mid-gesture (would break Fabric's drag
    // setup): canvas interactions apply it on mouse:up instead.
    function applyStoreSelection() {
      const project = useProjectStore.getState().project
      if (!project) return
      const ids = useCanvasStore.getState().selectedLayerIds
      const objectsById = new Map<string, RenderedObject>()
      for (const object of canvas.getObjects() as RenderedObject[]) {
        if (object.data?.uid) objectsById.set(object.data.uid, object)
      }
      const targets = resolveSelectionObjects(project, objectsById, ids)
      const activeObjects = canvas.getActiveObjects() as RenderedObject[]
      if (activeObjects.length === targets.length
        && targets.every((target) => activeObjects.includes(target))) return
      // Swallow the echo selection events fired by these mutations.
      applyingStoreSelection.current = true
      if (targets.length === 0) canvas.discardActiveObject()
      else if (targets.length === 1) canvas.setActiveObject(targets[0])
      else canvas.setActiveObject(new ActiveSelection(targets, { canvas }))
      syncTextCursors()
      canvas.requestRenderAll()
      queueMicrotask(() => {
        applyingStoreSelection.current = false
      })
    }

    const unsubscribeStoreSelection = useCanvasStore.subscribe((state, previous) => {
      if (sameIds(state.selectedLayerIds, previous.selectedLayerIds)) return
      if (interacting.current || syncing.current) return
      applyStoreSelection()
    })

    // Fabric emits its canvas mouse:down AFTER selection events, which is too
    // late to flag an ongoing gesture — DOM capture phase runs before both.
    const handleDomMouseDown = () => {
      interacting.current = true
    }
    const handleDomMouseUp = () => {
      interacting.current = false
    }
    canvas.upperCanvasEl.addEventListener('mousedown', handleDomMouseDown, true)
    window.addEventListener('mouseup', handleDomMouseUp, true)

    // Swapping to the union selection on mousedown would break Fabric's drag
    // setup, so it happens on mouse:up. During a first-gesture drag of one
    // instance, mirror the delta to its echoes to keep the panorama coherent.
    // Repères et cibles d'accroche : vivent le temps d'un geste, jamais dans le
    // graphe d'objets — sinon ils apparaîtraient dans la liste des calques,
    // dans l'historique et dans le PNG exporté.
    let guides: Guide[] = []
    let snapTargets: Box[] | null = null

    canvas.on('after:render', () => {
      if (guides.length > 0) drawGuides(canvas, guides)
      // Une seule source pour la position de la barre contextuelle : elle suit
      // ainsi le zoom, le pan et la sélection sans un abonnement par cas. Le
      // rendu React n'a lieu que si le rectangle arrondi a réellement bougé, et
      // jamais pendant un geste — la barre s'efface le temps du déplacement.
      const next = interacting.current ? null : readSelectionFrame(canvas)
      if (sameFrame(next, publishedFrame.current)) return
      publishedFrame.current = next
      setSelectionFrame(next)
    })

    const mirrorLast = new Map<string, { left: number; top: number }>()
    canvas.on('object:moving', (event) => {
      const target = event.target as RenderedObject | undefined
      if (!target) return

      const members = target instanceof ActiveSelection
        ? target.getObjects() as RenderedObject[]
        : [target]
      const localMembers = members.filter((object) => !object.data?.layout)
      for (const object of localMembers) {
        const sourceIndex = object.data?.screenIndex
        if (sourceIndex !== undefined && !dragSourceScreenIndexes.has(object)) {
          dragSourceScreenIndexes.set(object, sourceIndex)
        }
      }
      const targetScreenIndex = screenIndexAtPoint(
        useProjectStore.getState().project?.screens ?? [],
        target.getCenterPoint(),
      )
      if (targetScreenIndex !== null && localMembers.some(
        (object) => object.data?.screenIndex !== targetScreenIndex,
      )) {
        for (const object of localMembers) {
          object.set('data', { ...object.data, screenIndex: targetScreenIndex })
          ensureScreenClipPath(object, targetScreenIndex)
        }
        snapTargets = null
      }

      const pointerEvent = event.e as MouseEvent | TouchEvent
      // ⌘ ou Ctrl maintenu : positionnement libre, comme dans tout éditeur.
      const freehand = 'metaKey' in pointerEvent && (pointerEvent.metaKey || pointerEvent.ctrlKey)
      if (freehand) {
        guides = []
      } else {
        snapTargets ??= collectSnapTargets(canvas, target)
        const snap = computeSnap(boxOf(target), snapTargets, SNAP_DISTANCE_PX / canvas.getZoom())
        if (snap.dx !== 0 || snap.dy !== 0) {
          target.set({ left: target.left + snap.dx, top: target.top + snap.dy })
          target.setCoords()
        }
        guides = snap.guides
      }

      if (target instanceof ActiveSelection || !target.data?.layout) return
      const layerId = target.data.layerId
      if (!layerId) return
      const last = mirrorLast.get(layerId) ?? { left: target.left, top: target.top }
      const dx = target.left - last.left
      const dy = target.top - last.top
      mirrorLast.set(layerId, { left: target.left, top: target.top })
      if (dx === 0 && dy === 0) return
      for (const object of layoutInstances.current.get(layerId) ?? []) {
        if (object === target) continue
        object.set({ left: object.left + dx, top: object.top + dy })
        object.setCoords()
      }
      canvas.requestRenderAll()
    })
    canvas.on('mouse:up', () => {
      mirrorLast.clear()
      dragSourceScreenIndexes.clear()
      guides = []
      snapTargets = null
      interacting.current = false
      applyStoreSelection()
      canvas.requestRenderAll()
    })

    // Persist direct on-canvas text edits (double-click → type) back to the store.
    canvas.on('text:editing:exited', (event) => {
      const target = event.target as RenderedObject | undefined
      if (!target || !(target instanceof Textbox)) return
      const data = (target as RenderedObject).data
      const layerId = data?.layerId ?? data?.uid
      if (!layerId) return
      const layers = useCanvasStore.getState().layers
      const layer = layers.find((candidate) => candidate.id === layerId)
      if (layer?.type === 'text' && layer.content !== target.text) {
        useCanvasStore.getState().updateLayer(layerId, { content: target.text })
      }
    })

    canvas.on('selection:created', () => handleSelection())
    canvas.on('selection:updated', () => handleSelection())
    canvas.on('selection:cleared', () => {
      if (ignoreSelectionCleared.current || applyingStoreSelection.current) return
      if (!syncing.current) useCanvasStore.getState().clearSelection()
    })

    canvas.on('mouse:wheel', ({ e }: { e: WheelEvent }) => {
      e.preventDefault()
      if (e.metaKey || e.ctrlKey) {
        const zoom = Math.min(4, Math.max(0.1, canvas.getZoom() * 0.999 ** e.deltaY))
        canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom)
        setZoom(zoom)
      } else {
        canvas.relativePan(new Point(-e.deltaX, -e.deltaY))
      }
      // Batch wheel bursts into one render per frame.
      if (!wheelRenderQueued.current) {
        wheelRenderQueued.current = true
        requestAnimationFrame(() => {
          wheelRenderQueued.current = false
          canvas.requestRenderAll()
        })
      }
    })

    // ── Déplacement de la vue : espace maintenu, ou clic molette ──────────────
    // Alt et glisser a été retiré : dans tout éditeur de maquette ce geste
    // duplique, et le réserver au pan condamnait la duplication au drag.
    let spaceHeld = false
    function setPanMode(active: boolean): void {
      if (spaceHeld === active) return
      spaceHeld = active
      canvas.defaultCursor = active ? 'grab' : 'default'
      // Sans cela un clic pendant le pan attraperait l'objet sous le curseur.
      canvas.skipTargetFind = active
      canvas.selection = !active
      canvas.setCursor(active ? 'grab' : 'default')
    }

    function isTypingTarget(): boolean {
      const element = document.activeElement as HTMLElement | null
      if (!element) return false
      // Pendant l'édition en place, Fabric focalise un textarea caché : le test
      // couvre donc aussi ce cas, et l'espace y reste un espace.
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
        || element.isContentEditable
    }

    function handleCanvasKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget()) return
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        setPanMode(true)
        return
      }
      // Entrée ouvre l'édition en place : le double-clic la propose déjà mais
      // rien ne l'annonçait, et le clavier n'y donnait aucun accès.
      if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        const target = canvas.getActiveObject()
        if (!(target instanceof Textbox) || !target.selectable) return
        event.preventDefault()
        target.enterEditing()
        target.selectAll()
        canvas.requestRenderAll()
      }
    }
    function handleCanvasKeyUp(event: KeyboardEvent): void {
      if (event.code === 'Space') setPanMode(false)
    }
    // ⌘-Tab pendant l'appui laisserait le pan armé sans jamais voir le relâchement.
    const releasePanMode = () => setPanMode(false)
    window.addEventListener('keydown', handleCanvasKeyDown)
    window.addEventListener('keyup', handleCanvasKeyUp)
    window.addEventListener('blur', releasePanMode)

    canvas.on('mouse:down', (event) => {
      const pointerEvent = event.e as MouseEvent | TouchEvent
      if (!('button' in pointerEvent)) return
      if (spaceHeld || pointerEvent.button === 1) {
        panning.current = true
        panPoint.current = { x: pointerEvent.clientX, y: pointerEvent.clientY }
        canvas.selection = false
        canvas.setCursor('grabbing')
      }
    })
    canvas.on('mouse:move', (event) => {
      if (!panning.current || !panPoint.current) return
      const pointerEvent = event.e as MouseEvent | TouchEvent
      if (!('clientX' in pointerEvent)) return
      canvas.relativePan(new Point(
        pointerEvent.clientX - panPoint.current.x,
        pointerEvent.clientY - panPoint.current.y,
      ))
      panPoint.current = { x: pointerEvent.clientX, y: pointerEvent.clientY }
    })
    canvas.on('mouse:up', () => {
      if (!panning.current) return
      panning.current = false
      panPoint.current = null
      // Espace toujours enfoncé : on revient au pan armé, pas au mode normal.
      canvas.selection = !spaceHeld
      canvas.setCursor(spaceHeld ? 'grab' : 'default')
    })

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const resizeObserver = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect
      if (!size || size.width < 1 || size.height < 1) return
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        canvas.setDimensions({ width: Math.floor(size.width), height: Math.floor(size.height) })
        canvas.requestRenderAll()
      }, 80)
    })
    resizeObserver.observe(container)

    const project = useProjectStore.getState().project
    if (project) {
      void sync(project).then(() => fitAll(canvas, project.screens.length))
    }

    return () => {
      unsubscribeStoreSelection()
      canvas.upperCanvasEl.removeEventListener('mousedown', handleDomMouseDown, true)
      window.removeEventListener('mouseup', handleDomMouseUp, true)
      window.removeEventListener('keydown', handleCanvasKeyDown)
      window.removeEventListener('keyup', handleCanvasKeyUp)
      window.removeEventListener('blur', releasePanMode)
      resizeObserver.disconnect()
      if (resizeTimer) clearTimeout(resizeTimer)
      if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current)
      for (const object of canvas.getObjects() as RenderedObject[]) {
        disposeFabricObjectResource(object)
      }
      canvas.dispose()
      fabricRef.current = null
    }
  }, [fitAll, setZoom, sync])

  useEffect(() => useProjectStore.subscribe((state, previous) => {
    const canvas = fabricRef.current
    if (!canvas || !state.project) return
    const change = diffProjectChange(state.project, previous.project)
    if (change.type === 'none') return
    if (change.type === 'patch') {
      const project = state.project
      void syncPatch(project, change).then((patched) => {
        if (!patched) void sync(project)
      })
      return
    }
    const screenCountChanged = state.project.screens.length !== previous.project?.screens.length
    void sync(state.project).then(() => {
      if (screenCountChanged) fitAll(canvas, state.project?.screens.length ?? 1)
    })
  }), [fitAll, sync, syncPatch])

  const applyThemeToCanvas = useCallback(() => {
    const canvas = fabricRef.current
    const project = useProjectStore.getState().project
    if (!canvas || !project) return
    const chrome = readChromeColors()
    applyLassoColors(canvas, chrome)
    for (const object of canvas.getObjects() as RenderedObject[]) {
      const data = object.data
      if (data?.rendererType === 'label') {
        object.set('fill', chrome.label)
      } else if (data?.rendererType === 'background') {
        const isActive = data.screenId === project.activeScreenId
        object.set({
          stroke: isActive ? chrome.activeRing : chrome.artboardRing,
          strokeWidth: isActive ? 2 : 1,
        })
      } else {
        applySelectionStyle(object)
      }
    }
    canvas.requestRenderAll()
  }, [])

  // Theme change: re-render chrome colors (labels, artboard rings, handles).
  // Différé d'une frame : la classe de thème est posée sur <html> par un effet
  // React, qui n'a pas encore tourné quand l'abonné Zustand est appelé.
  useEffect(() => useUIStore.subscribe((state, previous) => {
    if (state.theme === previous.theme) return
    requestAnimationFrame(applyThemeToCanvas)
  }), [applyThemeToCanvas])

  // Clicking a screen thumbnail centers the viewport on that artboard.
  useEffect(() => useCanvasStore.subscribe((state, previous) => {
    if (state.activeScreenId === previous.activeScreenId) return
    if (selectionFromCanvas.current) {
      selectionFromCanvas.current = false
      return
    }
    const canvas = fabricRef.current
    const project = useProjectStore.getState().project
    if (!canvas || !project) return
    const screenIndex = project.screens.findIndex((screen) => screen.id === state.activeScreenId)
    if (screenIndex === -1) return
    const { layersOpen, propsOpen } = useUIStore.getState()
    const insets = stageInsets({ layers: layersOpen, props: propsOpen })
    const availableWidth = Math.max(1, canvas.width - insets.left - insets.right)
    const availableHeight = Math.max(1, canvas.height - insets.top - insets.bottom)
    const padding = 48
    const zoom = Math.min(
      (availableWidth - padding * 2) / SCREEN_WIDTH,
      (availableHeight - padding * 2) / SCREEN_HEIGHT,
      1,
    )
    const screenCenterX = getScreenOffset(screenIndex) + SCREEN_WIDTH / 2
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      insets.left + availableWidth / 2 - screenCenterX * zoom,
      insets.top + (availableHeight - SCREEN_HEIGHT * zoom) / 2,
    ])
    useUIStore.getState().setZoom(zoom)
    canvas.requestRenderAll()
  }), [])

  useEffect(() => useUIStore.subscribe((state, previous) => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (state.viewportResetKey !== previous.viewportResetKey) {
      const project = useProjectStore.getState().project
      if (project) {
        fitAll(canvas, project.screens.length)
        canvas.requestRenderAll()
      }
      return
    }
    if (state.zoom === previous.zoom || Math.abs(canvas.getZoom() - state.zoom) < 0.0001) return
    canvas.zoomToPoint(canvas.getVpCenter(), state.zoom)
    canvas.requestRenderAll()
  }), [fitAll])

  return { canvasRef, containerRef, getLayerIdAtPoint, selectionFrame }
}
