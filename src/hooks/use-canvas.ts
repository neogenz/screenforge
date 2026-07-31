import { useCallback, useEffect, useRef } from 'react'
import {
  ActiveSelection,
  Canvas,
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
  backgroundToFabricFill,
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
import { isFontLoaded, loadGoogleFont } from '@/hooks/use-fonts'
import type { Layer, Project, Screen } from '@/types'

export { SCREEN_HEIGHT, SCREEN_WIDTH, getScreenOffset, getTotalWidth }

interface ChromeColors {
  label: string
  artboardRing: string
  activeRing: string
}

function readChromeColors(): ChromeColors {
  const themed = document.getElementById('root')?.firstElementChild ?? document.documentElement
  const styles = getComputedStyle(themed as Element)
  return {
    label: styles.getPropertyValue('--color-faint').trim() || '#74746e',
    artboardRing: styles.getPropertyValue('--color-artboard-ring').trim() || 'rgba(255,255,255,0.14)',
    activeRing: styles.getPropertyValue('--color-export').trim() || '#d71921',
  }
}

function createScreenClipPath(screenIndex: number): Rect {
  return new Rect({
    originX: 'left',
    originY: 'top',
    left: getScreenOffset(screenIndex),
    top: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    fill: '#000000',
    absolutePositioned: true,
  })
}

/**
 * Clip paths only depend on the screen index — reuse the existing Rect
 * instead of allocating a fresh one for every object on every sync.
 */
function ensureScreenClipPath(object: RenderedObject, screenIndex: number): void {
  if (object.data?.clipScreenIndex === screenIndex && object.clipPath) return
  object.clipPath = createScreenClipPath(screenIndex)
  object.set('data', { ...object.data, clipScreenIndex: screenIndex })
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
    const { showLayersPanel, showPropertiesPanel } = useUIStore.getState()
    const insets = stageInsets(showLayersPanel, showPropertiesPanel)
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
            shadow: new Shadow({ color: 'rgba(0,0,0,0.35)', blur: 24, offsetY: 4 }),
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
            fontFamily: '"Archivo", system-ui, sans-serif',
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
          applyLayerToFabricObject(
            object,
            layer,
            getScreenOffset(screenIndex) - screenIndex * SCREEN_WIDTH,
          )
          const isActiveInstance = screen.id === activeScreenId
          ensureScreenClipPath(object, screenIndex)
          object.set({
            selectable: !layer.locked && isActiveInstance,
            evented: !layer.locked && isActiveInstance,
          })
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
        applyLayerToFabricObject(object, layer, getScreenOffset(index) - index * SCREEN_WIDTH)
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

      const affectedScreenIds = new Set(objects.flatMap((object) =>
        object.data?.screenId ? [object.data.screenId] : [],
      ))
      const changesProjectLayout = objects.some((object) => object.data?.layout)
        || affectedScreenIds.size > 1
      if (changesProjectLayout) useCanvasStore.getState().recordProjectHistory()
      else useCanvasStore.getState().recordHistory()

      const updates = new Map<string, Map<string, Partial<Layer>>>()
      const layoutUpdates = new Map<string, Partial<Layer>>()
      for (const object of objects) {
        const layerId = object.data?.layerId ?? object.data?.uid
        const screenId = object.data?.screenId
        if (!layerId || !screenId) continue
        const screenIndex = project.screens.findIndex((screen) => screen.id === screenId)
        if (screenIndex === -1) continue
        if (object.data?.layout) {
          layoutUpdates.set(
            layerId,
            fabricObjectToLayerUpdate(
              object,
              getScreenOffset(screenIndex) - screenIndex * SCREEN_WIDTH,
            ) as Partial<Layer>,
          )
          continue
        }
        const screenUpdates = updates.get(screenId) ?? new Map<string, Partial<Layer>>()
        screenUpdates.set(
          layerId,
          fabricObjectToLayerUpdate(object, getScreenOffset(screenIndex)) as Partial<Layer>,
        )
        updates.set(screenId, screenUpdates)
      }
      if (updates.size === 0 && layoutUpdates.size === 0) return

      if (target instanceof ActiveSelection) {
        // The discard fires selection:cleared synchronously — the store must
        // keep the selection so the upcoming sync can re-apply it.
        ignoreSelectionCleared.current = true
        canvas.discardActiveObject()
        queueMicrotask(() => {
          ignoreSelectionCleared.current = false
        })
      }
      const screens = project.screens.map((screen) => {
        const screenUpdates = updates.get(screen.id)
        if (!screenUpdates) return screen
        return {
          ...screen,
          layers: screen.layers.map((layer) => ({
            ...layer,
            ...screenUpdates.get(layer.id),
          }) as Layer),
        }
      })
      useProjectStore.setState({
        project: {
          ...project,
          screens,
          layoutLayers: project.layoutLayers.map((layer) => ({
            ...layer,
            ...layoutUpdates.get(layer.id),
            scope: 'layout',
          }) as Layer),
          updatedAt: Math.max(Date.now(), project.updatedAt + 1),
        },
      })
      useCanvasStore.getState().syncLayersFromProject()
    })

    function handleSelection() {
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
    const mirrorLast = new Map<string, { left: number; top: number }>()
    canvas.on('object:moving', (event) => {
      const target = event.target as RenderedObject | undefined
      if (!target || target instanceof ActiveSelection || !target.data?.layout) return
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
      interacting.current = false
      applyStoreSelection()
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

    canvas.on('mouse:down', (event) => {
      const pointerEvent = event.e as MouseEvent | TouchEvent
      if (!('button' in pointerEvent)) return
      if (pointerEvent.altKey || pointerEvent.button === 1) {
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
      canvas.selection = true
      canvas.setCursor('default')
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

  // Theme change: re-render chrome colors (labels, artboard rings).
  useEffect(() => useUIStore.subscribe((state, previous) => {
    if (state.theme === previous.theme) return
    const canvas = fabricRef.current
    const project = useProjectStore.getState().project
    if (!canvas || !project) return
    const chrome = readChromeColors()
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
      }
    }
    canvas.requestRenderAll()
  }), [])

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
    const { showLayersPanel, showPropertiesPanel } = useUIStore.getState()
    const insets = stageInsets(showLayersPanel, showPropertiesPanel)
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
    const panelsChanged = state.showLayersPanel !== previous.showLayersPanel
      || state.showPropertiesPanel !== previous.showPropertiesPanel
    if (state.viewportResetKey !== previous.viewportResetKey || panelsChanged) {
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

  return { canvasRef, containerRef, getLayerIdAtPoint }
}
