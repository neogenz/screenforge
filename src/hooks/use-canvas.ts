import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActiveSelection,
  Canvas,
  Point,
  Rect,
  Textbox,
  util,
} from 'fabric'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  applySelectionStyle,
  disposeFabricObjectResource,
  fabricObjectToLayerUpdate,
  getScreenOffset,
  getTotalWidth,
  type RenderedObject,
} from '@/lib/canvas/canvas-utils'
import {
  SNAP_DISTANCE_PX,
  applyLassoColors,
  boxOf,
  collectSnapTargets,
  drawGuides,
  readChromeColors,
  readSelectionFrame,
  resolveSelectionObjects,
  sameFrame,
  sameIds,
  screenIndexAtPoint,
  type SelectionFrame,
} from '@/lib/canvas/canvas-interactions'
import {
  ensureScreenClipPath,
  patchCanvas,
  syncCanvas,
  type CanvasSyncRuntime,
} from '@/lib/canvas/canvas-sync'
import { installControlsPatch } from '@/lib/canvas/controls-patch'
import { useCanvasStore } from '@/stores/canvas.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { stageInsets } from '@/lib/stage'
import { nextTimestamp } from '@/lib/time'
import { computeSnap } from '@/lib/snapping'
import type { Box, Guide } from '@/lib/snapping'
import { diffProjectChange } from '@/lib/canvas/project-diff'
import { applyLayerTransfer } from '@/lib/layer-transfer'
import type { LayoutLayerUpdate, LocalLayerTransfer } from '@/lib/layer-transfer'
import type { Layer, Project, Screen } from '@/types'

export { SCREEN_HEIGHT, SCREEN_WIDTH, getScreenOffset, getTotalWidth }
export type { SelectionFrame } from '@/lib/canvas/canvas-interactions'

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
    await syncCanvas(project, {
      canvas,
      currentCanvas: () => fabricRef.current,
      syncVersion,
      syncing,
      fontLoadRequests: fontLoadRequests.current,
      layoutInstances,
      generateThumbnails,
    })
  }, [generateThumbnails])

  const syncPatch = useCallback(async (
    project: Project,
    change: Extract<ReturnType<typeof diffProjectChange>, { type: 'patch' }>,
  ): Promise<boolean> => {
    const canvas = fabricRef.current
    if (!canvas) return false
    const runtime: CanvasSyncRuntime = {
      canvas,
      currentCanvas: () => fabricRef.current,
      syncVersion,
      syncing,
      fontLoadRequests: fontLoadRequests.current,
      layoutInstances,
      generateThumbnails,
    }
    return patchCanvas(project, change, runtime)
  }, [generateThumbnails])

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    installControlsPatch()
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
      if (destinationScreenId && destinationScreenId !== project.activeScreenId) {
        // The project subscription runs synchronously. Mark canvas-originated
        // navigation before publishing the transfer so it preserves framing.
        selectionFromCanvas.current = true
      }
      useProjectStore.setState({
        project: {
          ...project,
          activeScreenId: destinationScreenId ?? project.activeScreenId,
          screens: next.screens,
          layoutLayers: next.layoutLayers,
          updatedAt: nextTimestamp(project.updatedAt),
        },
      })
      const canvasStore = useCanvasStore.getState()
      if (destinationScreenId) {
        const selectedIds = [...new Set(objects.flatMap((object) => {
          const id = object.data?.layerId ?? object.data?.uid
          return id ? [id] : []
        }))]
        canvasStore.selectLayers(selectedIds)
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
      const project = useProjectStore.getState().project
      if (screenId && screenId !== project?.activeScreenId) {
        selectionFromCanvas.current = true
        useProjectStore.getState().setActiveScreenId(screenId)
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
      const layers = getProjectLayers(useProjectStore.getState().project)
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
  useEffect(() => useProjectStore.subscribe((state, previous) => {
    const activeScreenId = state.project?.activeScreenId
    if (!activeScreenId || activeScreenId === previous.project?.activeScreenId) return
    if (selectionFromCanvas.current) {
      selectionFromCanvas.current = false
      return
    }
    const canvas = fabricRef.current
    const project = state.project
    if (!canvas || !project) return
    const screenIndex = project.screens.findIndex((screen) => screen.id === activeScreenId)
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
