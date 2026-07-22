import { useCallback, useEffect, useRef } from 'react'
import {
  ActiveSelection,
  Canvas,
  Group,
  Point,
  Rect,
  Shadow,
  Textbox,
  type FabricObject,
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
import { useHistoryStore } from '@/stores/history.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import type { Layer, Project, Screen } from '@/types'

export { SCREEN_HEIGHT, SCREEN_WIDTH, getScreenOffset, getTotalWidth }

function createScreensClipPath(screenCount: number): Group {
  return new Group(
    Array.from({ length: screenCount }, (_, index) => new Rect({
      originX: 'left',
      originY: 'top',
      left: getScreenOffset(index),
      top: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      fill: '#000000',
    })),
    { originX: 'left', originY: 'top', absolutePositioned: true },
  )
}

function screensHaveVisualChanges(current: Project, previous: Project | null): boolean {
  if (!previous || current.screens.length !== previous.screens.length) return true
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

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const syncing = useRef(false)
  const syncVersion = useRef(0)
  const panning = useRef(false)
  const panPoint = useRef<{ x: number; y: number } | null>(null)
  const thumbnailTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thumbnailGeneration = useRef(0)
  const setZoom = useUIStore((state) => state.setZoom)

  const generateThumbnails = useCallback((screens: Screen[]) => {
    if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current)
    const generation = ++thumbnailGeneration.current

    thumbnailTimer.current = setTimeout(() => {
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
    }, 300)
  }, [])

  const fitAll = useCallback((canvas: Canvas, screenCount: number) => {
    const totalWidth = getTotalWidth(screenCount)
    const padding = 80
    const zoom = Math.min(
      (canvas.width - padding * 2) / totalWidth,
      (canvas.height - padding * 2) / SCREEN_HEIGHT,
      1,
    )
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      (canvas.width - totalWidth * zoom) / 2,
      (canvas.height - SCREEN_HEIGHT * zoom) / 2,
    ])
    setZoom(zoom)
  }, [setZoom])

  const sync = useCallback(async (screens: Screen[]) => {
    const canvas = fabricRef.current
    if (!canvas) return
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
      }
      for (const [id, object] of objectsById) {
        if (wantedIds.has(id)) continue
        canvas.remove(object)
        disposeFabricObjectResource(object)
        objectsById.delete(id)
      }

      const clipPath = createScreensClipPath(screens.length)
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
            rx: 4,
            ry: 4,
            selectable: false,
            evented: false,
            shadow: new Shadow({ color: 'rgba(0,0,0,0.22)', blur: 16, offsetY: 3 }),
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
        })
        background.setCoords()

        const labelId = `label:${screen.id}`
        let label = objectsById.get(labelId)
        if (!label) {
          label = new Textbox('', {
            originX: 'left',
            originY: 'top',
            width: SCREEN_WIDTH,
            fontSize: 11,
            fontFamily: 'Inter, system-ui, sans-serif',
            fill: 'rgba(255,255,255,0.55)',
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
        label.set({ left: offset, top: -24, text: screen.name })
        label.setCoords()

        for (const layer of screen.layers) {
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
            screenId: screen.id,
            rendererType: layer.type,
          })
          applyLayerToFabricObject(object, layer, offset)
          object.clipPath = clipPath
        }
      }

      const orderedObjects: RenderedObject[] = []
      for (const screen of screens) {
        const background = objectsById.get(`background:${screen.id}`)
        if (background) orderedObjects.push(background)
      }
      for (const screen of screens) {
        for (const layer of [...screen.layers].sort((left, right) => left.zIndex - right.zIndex)) {
          const object = objectsById.get(layer.id)
          if (object) orderedObjects.push(object)
        }
      }
      for (const screen of screens) {
        const label = objectsById.get(`label:${screen.id}`)
        if (label) orderedObjects.push(label)
      }
      orderedObjects.forEach((object, index) => canvas.moveObjectTo(object, index))

      const selectedIds = useCanvasStore.getState().selectedLayerIds
      const currentSelectionIds = canvas.getActiveObjects()
        .map((object) => (object as RenderedObject).data?.uid)
        .filter((id): id is string => Boolean(id))
      if (!sameIds(currentSelectionIds, selectedIds)) {
        const selectedObjects = selectedIds.flatMap((id) => {
          const object = objectsById.get(id)
          return object ? [object] : []
        })
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

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const container = containerRef.current
    const bounds = container.getBoundingClientRect()
    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: 'transparent',
      width: bounds.width,
      height: bounds.height,
      selection: true,
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas

    canvas.on('object:modified', (event) => {
      if (syncing.current || !event.target) return
      const target = event.target
      const objects = target instanceof ActiveSelection
        ? target.getObjects() as RenderedObject[]
        : [target as RenderedObject]
      const project = useProjectStore.getState().project
      if (!project) return

      const activeScreenId = useCanvasStore.getState().activeScreenId
      if (objects.some((object) => object.data?.screenId === activeScreenId)) {
        useHistoryStore.getState().record(JSON.stringify(useCanvasStore.getState().layers))
      }

      const updates = new Map<string, Map<string, Partial<Layer>>>()
      for (const object of objects) {
        const layerId = object.data?.uid
        const screenId = object.data?.screenId
        if (!layerId || !screenId) continue
        const screenIndex = project.screens.findIndex((screen) => screen.id === screenId)
        if (screenIndex === -1) continue
        const screenUpdates = updates.get(screenId) ?? new Map<string, Partial<Layer>>()
        screenUpdates.set(
          layerId,
          fabricObjectToLayerUpdate(object, getScreenOffset(screenIndex)) as Partial<Layer>,
        )
        updates.set(screenId, screenUpdates)
      }
      if (updates.size === 0) return

      if (target instanceof ActiveSelection) canvas.discardActiveObject()
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
          updatedAt: Math.max(Date.now(), project.updatedAt + 1),
        },
      })
      useCanvasStore.getState().syncLayersFromProject()
    })

    function handleSelection(objects: FabricObject[]) {
      if (syncing.current) return
      const renderedObjects = objects as RenderedObject[]
      const ids = renderedObjects.flatMap((object) => object.data?.uid ? [object.data.uid] : [])
      const screenId = renderedObjects.find((object) => object.data?.screenId)?.data?.screenId
      if (screenId && screenId !== useCanvasStore.getState().activeScreenId) {
        useCanvasStore.getState().setActiveScreenId(screenId)
      }
      if (ids.length === 1) useCanvasStore.getState().selectLayer(ids[0])
      else if (ids.length > 1) useCanvasStore.getState().selectLayers(ids)
    }

    canvas.on('selection:created', (event) => handleSelection(event.selected ?? []))
    canvas.on('selection:updated', (event) => handleSelection(event.selected ?? []))
    canvas.on('selection:cleared', () => {
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
      canvas.requestRenderAll()
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

    const resizeObserver = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect
      if (!size || size.width < 1 || size.height < 1) return
      canvas.setDimensions({ width: size.width, height: size.height })
      canvas.requestRenderAll()
    })
    resizeObserver.observe(container)

    const project = useProjectStore.getState().project
    if (project) {
      void sync(project.screens).then(() => fitAll(canvas, project.screens.length))
    }

    return () => {
      resizeObserver.disconnect()
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
    if (!canvas || !state.project || !screensHaveVisualChanges(state.project, previous.project)) return
    const screenCountChanged = state.project.screens.length !== previous.project?.screens.length
    void sync(state.project.screens).then(() => {
      if (screenCountChanged) fitAll(canvas, state.project?.screens.length ?? 1)
    })
  }), [fitAll, sync])

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

  return { canvasRef, containerRef }
}
