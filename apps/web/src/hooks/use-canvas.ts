import { useCallback, useEffect, useRef, useState } from 'react'
import { ActiveSelection, Canvas, Point, Rect, Shadow, util } from 'fabric'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  applySelectionStyle,
  disposeFabricObjectResource,
  getScreenOffset,
  getTotalWidth,
  type RenderedObject,
} from '@/lib/canvas/canvas-utils'
import {
  applyLassoColors,
  artboardStyle,
  readChromeColors,
  type SelectionFrame,
} from '@/lib/canvas/canvas-interactions'
import { patchCanvas, syncCanvas, type CanvasSyncRuntime } from '@/lib/canvas/canvas-sync'
import { installControlsPatch } from '@/lib/canvas/controls-patch'
import { installFonts } from '@/lib/canvas/install-fonts'
import { installInteractions } from '@/lib/canvas/install-interactions'
import { installThumbnails, type ThumbnailScheduler } from '@/lib/canvas/install-thumbnails'
import { installViewport, type ViewportController } from '@/lib/canvas/install-viewport'
import { diffProjectChange, type ProjectChange } from '@/lib/canvas/project-diff'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import type { Project, Screen } from '@/types'

export { SCREEN_HEIGHT, SCREEN_WIDTH, getScreenOffset, getTotalWidth }
export type { SelectionFrame } from '@/lib/canvas/canvas-interactions'

type PatchChange = Extract<ProjectChange, { type: 'patch' }>
type PatchJob = { project: Project; change: PatchChange }

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const syncing = useRef(false)
  const syncVersion = useRef(0)
  const selectionFromCanvas = useRef(false)
  const fontLoadRequests = useRef(new Set<string>())
  const layoutInstances = useRef(new Map<string, RenderedObject[]>())
  const thumbnails = useRef<ThumbnailScheduler | null>(null)
  const viewport = useRef<ViewportController | null>(null)
  const patchInFlight = useRef(false)
  const pendingPatch = useRef<PatchJob | 'full' | null>(null)
  const [selectionFrame, setSelectionFrame] = useState<SelectionFrame | null>(null)

  const generateThumbnails = useCallback((screens: Screen[]) => {
    thumbnails.current?.schedule(screens)
  }, [])

  const getLayerIdAtPoint = useCallback((event: MouseEvent): string | null => {
    const canvas = fabricRef.current
    if (!canvas) return null
    const target = canvas.findTarget(event)?.target as RenderedObject | undefined
    const id = target?.data?.layerId ?? target?.data?.uid
    if (id) return id
    if (target instanceof ActiveSelection) {
      return useCanvasStore.getState().selectedLayerIds[0] ?? null
    }
    return null
  }, [])

  const sync = useCallback(
    async (project: Project) => {
      const canvas = fabricRef.current
      if (!canvas) return
      await syncCanvas(project, {
        canvas,
        syncVersion,
        syncing,
        fontLoadRequests: fontLoadRequests.current,
        layoutInstances,
        generateThumbnails,
      })
    },
    [generateThumbnails],
  )

  const syncPatch = useCallback(
    async (
      project: Project,
      change: Extract<ReturnType<typeof diffProjectChange>, { type: 'patch' }>,
    ): Promise<boolean> => {
      const canvas = fabricRef.current
      if (!canvas) return false
      const runtime: CanvasSyncRuntime = {
        canvas,
        syncVersion,
        syncing,
        fontLoadRequests: fontLoadRequests.current,
        layoutInstances,
        generateThumbnails,
      }
      return patchCanvas(project, change, runtime)
    },
    [generateThumbnails],
  )

  /**
   * Sérialise les patchs : un seul en vol, les suivants fusionnés puis rejoués.
   *
   * Deux patchs simultanés capturaient le même objet ; le premier décodage
   * résolu le remplaçait, le second échouait, et le repli était une
   * réconciliation complète — potentiellement à chaque paire de ticks
   * chevauchés pendant un scrub de cadrage avec une capture lourde, exactement
   * ce que le chemin patch existe à éviter. Les ticks arrivés pendant un
   * décodage sont fusionnés (union des calques, projet le plus récent) et
   * joués en une passe : l'état final est le même, sans course.
   */
  const drainPatches = useCallback(
    async (first: PatchJob) => {
      patchInFlight.current = true
      try {
        let job: PatchJob | null = first
        while (job) {
          const patched = await syncPatch(job.project, job.change)
          if (!patched) {
            /* Le patch a renoncé (police pas encore chargée, objet absent) :
               resynchroniser sur le projet *courant*, pas celui capturé, sinon
               le canvas resterait en retard d'un tick sans qu'aucun événement
               ne vienne le réveiller. */
            pendingPatch.current = null
            await sync(useProjectStore.getState().project ?? job.project)
            return
          }
          const pending = pendingPatch.current
          pendingPatch.current = null
          if (pending === 'full') {
            await sync(useProjectStore.getState().project ?? job.project)
            return
          }
          job = pending
        }
      } finally {
        patchInFlight.current = false
      }
    },
    [sync, syncPatch],
  )

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
      stopContextMenu: false,
    })
    fabricRef.current = canvas
    if (import.meta.env.DEV) {
      const debug = window as unknown as {
        __sfCanvas?: Canvas
        __sfFabric?: unknown
        __sfSyncVersion?: { current: number }
      }
      debug.__sfCanvas = canvas
      debug.__sfFabric = { Rect, ActiveSelection, Point, util }
      // Instrumentation e2e : une full sync l'incrémente, un patch non — c'est
      // ainsi que le spec de scrub prouve que le chemin patch tient.
      debug.__sfSyncVersion = syncVersion
    }

    const thumbnailController = installThumbnails({
      currentCanvas: () => fabricRef.current,
      onGenerated: (generated) => {
        const project = useProjectStore.getState().project
        if (!project) return
        const screens = project.screens.map((screen) => {
          const thumbnail = generated[screen.id]
          return thumbnail && thumbnail !== screen.thumbnail ? { ...screen, thumbnail } : screen
        })
        if (screens.some((screen, index) => screen !== project.screens[index])) {
          useProjectStore.setState({ project: { ...project, screens } })
        }
      },
    })
    thumbnails.current = thumbnailController

    const fontsController = installFonts({
      currentCanvas: () => fabricRef.current,
      getProject: () => useProjectStore.getState().project,
      generateThumbnails,
    })

    const cleanupInteractions = installInteractions({
      canvas,
      syncing,
      selectionFromCanvas,
      layoutInstances,
      getProject: () => useProjectStore.getState().project,
      setProject: (project) => useProjectStore.setState({ project }),
      setActiveScreenId: (screenId) => useProjectStore.getState().setActiveScreenId(screenId),
      getSelectedLayerIds: () => useCanvasStore.getState().selectedLayerIds,
      subscribeSelection: (listener) =>
        useCanvasStore.subscribe((state, previous) => {
          listener(state.selectedLayerIds, previous.selectedLayerIds)
        }),
      recordHistory: () => useCanvasStore.getState().recordHistory(),
      recordProjectHistory: () => useCanvasStore.getState().recordProjectHistory(),
      selectLayer: (layerId) => useCanvasStore.getState().selectLayer(layerId),
      selectLayers: (layerIds) => useCanvasStore.getState().selectLayers(layerIds),
      clearSelection: () => useCanvasStore.getState().clearSelection(),
      updateLayer: (layerId, updates) => useCanvasStore.getState().updateLayer(layerId, updates),
      onSelectionFrame: setSelectionFrame,
      setTextRange: (range) => useCanvasStore.getState().setTextRange(range),
    })

    const viewportController = installViewport({
      canvas,
      container,
      selectionFromCanvas,
      getProject: () => useProjectStore.getState().project,
      getUi: () => useUIStore.getState(),
      setZoom: (zoom) => useUIStore.getState().setZoom(zoom),
      subscribeProject: (listener) =>
        useProjectStore.subscribe((state, previous) => {
          listener(state.project, previous.project)
        }),
      subscribeUi: (listener) => useUIStore.subscribe(listener),
    })
    viewport.current = viewportController

    const project = useProjectStore.getState().project
    if (project) void sync(project).then(viewportController.fitAll)

    return () => {
      cleanupInteractions()
      viewportController.cleanup()
      thumbnailController.cleanup()
      fontsController.cleanup()
      viewport.current = null
      thumbnails.current = null
      for (const object of canvas.getObjects() as RenderedObject[]) {
        disposeFabricObjectResource(object)
      }
      canvas.dispose()
      fabricRef.current = null
    }
  }, [sync, generateThumbnails])

  useEffect(
    () =>
      useProjectStore.subscribe((state, previous) => {
        if (!fabricRef.current || !state.project) return
        const change = diffProjectChange(state.project, previous.project)
        if (change.type === 'none') return
        if (change.type === 'patch') {
          if (patchInFlight.current) {
            const pending = pendingPatch.current
            if (pending === 'full') return
            if (pending && pending.change.screenId !== change.screenId) {
              // Deux écrans dans la même fenêtre de décodage : le patch est
              // mono-écran par définition, la passe complète reprend la main.
              pendingPatch.current = 'full'
              return
            }
            pendingPatch.current = {
              project: state.project,
              change: pending
                ? {
                    type: 'patch',
                    screenId: change.screenId,
                    layerIds: [...new Set([...pending.change.layerIds, ...change.layerIds])],
                    layoutLayerIds: [
                      ...new Set([...pending.change.layoutLayerIds, ...change.layoutLayerIds]),
                    ],
                    backgroundChanged: pending.change.backgroundChanged || change.backgroundChanged,
                  }
                : change,
            }
            return
          }
          void drainPatches({ project: state.project, change })
          return
        }
        const screenCountChanged = state.project.screens.length !== previous.project?.screens.length
        void sync(state.project).then(() => {
          if (screenCountChanged) viewport.current?.fitAll()
        })
      }),
    [sync, drainPatches],
  )

  const applyThemeToCanvas = useCallback(() => {
    const canvas = fabricRef.current
    const project = useProjectStore.getState().project
    if (!canvas || !project) return
    const chrome = readChromeColors()
    applyLassoColors(canvas, chrome)
    for (const object of canvas.getObjects() as RenderedObject[]) {
      const data = object.data
      const isActive = data?.screenId === project.activeScreenId
      if (data?.rendererType === 'label') {
        object.set('fill', artboardStyle(chrome, isActive).labelFill)
      } else if (data?.rendererType === 'background') {
        const artboard = artboardStyle(chrome, isActive)
        object.set({
          stroke: artboard.stroke,
          strokeWidth: artboard.strokeWidth,
          shadow: new Shadow(artboard.shadow),
        })
      } else {
        applySelectionStyle(object)
      }
    }
    canvas.requestRenderAll()
  }, [])

  useEffect(
    () =>
      useUIStore.subscribe((state, previous) => {
        if (state.theme === previous.theme) return
        requestAnimationFrame(applyThemeToCanvas)
      }),
    [applyThemeToCanvas],
  )

  return { canvasRef, containerRef, getLayerIdAtPoint, selectionFrame }
}
