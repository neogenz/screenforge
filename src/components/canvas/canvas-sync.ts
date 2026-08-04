import { ActiveSelection, Canvas, Rect, Shadow, Textbox } from 'fabric'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  applyLayerToFabricObject,
  backgroundToFabricFill,
  clipContentToScreen,
  clipControlsToScreen,
  disposeFabricObjectResource,
  getScreenOffset,
  layerToFabricObject,
  needsFabricObjectRecreation,
  type RenderedObject,
} from '@/components/canvas/canvas-utils'
import {
  applyLassoColors,
  readChromeColors,
  resolveSelectionObjects,
  sameIds,
} from '@/components/canvas/canvas-interactions'
import { DEFAULT_CANVAS_SHADOW_COLOR } from '@/lib/content-defaults'
import type { ProjectChange } from '@/lib/canvas/project-diff'
import { useCanvasStore } from '@/stores/canvas.store'
import { isFontLoaded, loadGoogleFont } from '@/hooks/use-fonts'
import type { Layer, Project, Screen } from '@/types'

type MutableValue<T> = { current: T }

export type CanvasSyncRuntime = {
  canvas: Canvas
  currentCanvas: () => Canvas | null
  syncVersion: MutableValue<number>
  syncing: MutableValue<boolean>
  fontLoadRequests: Set<string>
  layoutInstances: MutableValue<Map<string, RenderedObject[]>>
  generateThumbnails: (screens: Screen[]) => void
}

const MIN_GRABBABLE = 8

function intersectsScreen(object: RenderedObject, screenIndex: number): boolean {
  const bounds = object.getBoundingRect()
  const windowLeft = getScreenOffset(screenIndex)
  const overlapX = Math.min(bounds.left + bounds.width, windowLeft + SCREEN_WIDTH)
    - Math.max(bounds.left, windowLeft)
  const overlapY = Math.min(bounds.top + bounds.height, SCREEN_HEIGHT) - Math.max(bounds.top, 0)
  return overlapX > MIN_GRABBABLE && overlapY > MIN_GRABBABLE
}

export function ensureScreenClipPath(object: RenderedObject, screenIndex: number): void {
  if (object.data?.clipScreenIndex === screenIndex) return
  clipContentToScreen(object, screenIndex)
  clipControlsToScreen(object, screenIndex)
  object.set('data', { ...object.data, clipScreenIndex: screenIndex })
}

function applyLayoutInstance(
  object: RenderedObject,
  layer: Layer,
  screenIndex: number,
): void {
  applyLayerToFabricObject(object, layer, getScreenOffset(screenIndex) - screenIndex * SCREEN_WIDTH)
  ensureScreenClipPath(object, screenIndex)
  const visible = intersectsScreen(object, screenIndex)
  object.set({ selectable: !layer.locked && visible, evented: !layer.locked && visible })
}

function requestLayerFont(layer: Layer, runtime: CanvasSyncRuntime): void {
  if (layer.type !== 'text') return
  const fontKey = `${layer.fontFamily}:${layer.fontWeight}`
  if (isFontLoaded(layer.fontFamily, [String(layer.fontWeight)])) return
  if (runtime.fontLoadRequests.has(fontKey)) return
  runtime.fontLoadRequests.add(fontKey)
  void loadGoogleFont(layer.fontFamily, [String(layer.fontWeight)]).then((result) => {
    if (result.status !== 'loaded') return
    const canvas = runtime.currentCanvas()
    if (!canvas) return
    for (const object of canvas.getObjects() as RenderedObject[]) {
      if (object.data?.layerId !== layer.id) continue
      if (object instanceof Textbox) object.initDimensions()
      object.setCoords()
    }
    canvas.requestRenderAll()
  })
}

export async function syncCanvas(project: Project, runtime: CanvasSyncRuntime): Promise<void> {
  const { canvas } = runtime
  const { screens, layoutLayers, activeScreenId } = project
  const chrome = readChromeColors()
  applyLassoColors(canvas, chrome)
  const version = ++runtime.syncVersion.current
  runtime.syncing.current = true

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
        requestLayerFont(layer, runtime)
        let object = objectsById.get(layer.id)
        if (object && needsFabricObjectRecreation(object, layer)) {
          const replacement = await layerToFabricObject(layer)
          if (runtime.syncVersion.current !== version) {
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
          if (runtime.syncVersion.current !== version) {
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
      requestLayerFont(layer, runtime)
      for (let screenIndex = 0; screenIndex < screens.length; screenIndex += 1) {
        const screen = screens[screenIndex]
        const objectId = `layout:${layer.id}:${screen.id}`
        let object = objectsById.get(objectId)
        if (object && needsFabricObjectRecreation(object, layer)) {
          const replacement = await layerToFabricObject(layer)
          if (runtime.syncVersion.current !== version) {
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
          if (runtime.syncVersion.current !== version) {
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
    const wantedOrder = orderedObjects.map((object) => object.data?.uid ?? '')
    const currentOrder = (canvas.getObjects() as RenderedObject[])
      .map((object) => object.data?.uid ?? '')
    if (!sameIds(currentOrder, wantedOrder)) {
      orderedObjects.forEach((object, index) => canvas.moveObjectTo(object, index))
    }

    const instances = new Map<string, RenderedObject[]>()
    for (const layer of layoutLayers) {
      instances.set(layer.id, screens.flatMap((screen) => {
        const object = objectsById.get(`layout:${layer.id}:${screen.id}`)
        return object ? [object] : []
      }))
    }
    runtime.layoutInstances.current = instances

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
    runtime.generateThumbnails(screens)
  } catch (error) {
    console.error('Could not synchronize the canvas.', error)
  } finally {
    if (runtime.syncVersion.current === version) {
      requestAnimationFrame(() => {
        runtime.syncing.current = false
      })
    }
  }
}

export async function patchCanvas(
  project: Project,
  change: Extract<ProjectChange, { type: 'patch' }>,
  runtime: CanvasSyncRuntime,
): Promise<boolean> {
  const { canvas } = runtime
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
    if (layer.type === 'text' && !isFontLoaded(layer.fontFamily, [String(layer.fontWeight)])) return false
    applyLayerToFabricObject(object, layer, getScreenOffset(screenIndex))
  }

  for (const layerId of change.layoutLayerIds) {
    const layer = project.layoutLayers.find((candidate) => candidate.id === layerId)
    if (!layer) return false
    if (layer.type === 'text' && !isFontLoaded(layer.fontFamily, [String(layer.fontWeight)])) return false
    for (let index = 0; index < project.screens.length; index += 1) {
      const object = objectsById.get(`layout:${layerId}:${project.screens[index].id}`)
      if (!object) return false
      if (needsFabricObjectRecreation(object, layer)) return false
      applyLayoutInstance(object, layer, index)
    }
  }

  canvas.requestRenderAll()
  runtime.generateThumbnails(project.screens)
  return true
}
