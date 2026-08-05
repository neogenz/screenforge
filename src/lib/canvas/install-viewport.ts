import { Canvas, Point } from 'fabric'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  getScreenOffset,
  getTotalWidth,
} from '@/lib/canvas/canvas-utils'
import { stageInsets } from '@/lib/stage'
import { screenHasCustomName } from '@/lib/screens'
import type { Project } from '@/types'

/**
 * La pellicule porte-t-elle sa rangée de libellés ? Elle change la hauteur de
 * la bande, donc la zone libre — au même titre qu'un drawer qui s'ouvre.
 */
function hasLabelRow(project: Project | null): boolean {
  return Boolean(project?.screens.some(screenHasCustomName))
}

interface MutableValue<T> {
  current: T
}

interface ViewportUiState {
  layersOpen: boolean
  propsOpen: boolean
  viewportResetKey: number
  zoom: number
}

interface ViewportInstallerOptions {
  canvas: Canvas
  container: HTMLElement
  selectionFromCanvas: MutableValue<boolean>
  getProject: () => Project | null
  getUi: () => ViewportUiState
  setZoom: (zoom: number) => void
  subscribeProject: (
    listener: (project: Project | null, previous: Project | null) => void,
  ) => () => void
  subscribeUi: (
    listener: (state: ViewportUiState, previous: ViewportUiState) => void,
  ) => () => void
}

export interface ViewportController {
  fitAll: () => void
  cleanup: () => void
}

export function installViewport({
  canvas,
  container,
  selectionFromCanvas,
  getProject,
  getUi,
  setZoom,
  subscribeProject,
  subscribeUi,
}: ViewportInstallerOptions): ViewportController {
  let panning = false
  let panPoint: { x: number; y: number } | null = null
  let wheelFrame: number | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  let spaceHeld = false

  function availableStage() {
    const { layersOpen, propsOpen } = getUi()
    const insets = stageInsets({
      layers: layersOpen,
      props: propsOpen,
      labelled: hasLabelRow(getProject()),
    })
    return {
      insets,
      width: Math.max(1, canvas.width - insets.left - insets.right),
      height: Math.max(1, canvas.height - insets.top - insets.bottom),
    }
  }

  function fitAll(): void {
    const screenCount = getProject()?.screens.length ?? 1
    const { insets, width, height } = availableStage()
    const totalWidth = getTotalWidth(screenCount)
    const padding = 48
    const zoom = Math.min(
      (width - padding * 2) / totalWidth,
      (height - padding * 2) / SCREEN_HEIGHT,
      1,
    )
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      insets.left + (width - totalWidth * zoom) / 2,
      insets.top + (height - SCREEN_HEIGHT * zoom) / 2,
    ])
    setZoom(zoom)
  }

  /**
   * Recentre la scène sur la zone libre sans toucher au zoom.
   *
   * Recadrer entièrement écraserait un zoom et un panoramique choisis ; ne rien
   * faire laissait la transformation calculée pour l'ancienne taille, et les
   * planches dérivaient hors de l'écran. Le recadrage complet ne sert que
   * lorsque le contenu, au zoom courant, ne tient plus dans la zone libre.
   */
  function recenter(): void {
    const screenCount = getProject()?.screens.length ?? 1
    const { insets, width, height } = availableStage()
    const zoom = canvas.getZoom()
    const totalWidth = getTotalWidth(screenCount)

    if (totalWidth * zoom > width || SCREEN_HEIGHT * zoom > height) {
      fitAll()
      return
    }

    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      insets.left + (width - totalWidth * zoom) / 2,
      insets.top + (height - SCREEN_HEIGHT * zoom) / 2,
    ])
  }

  const disposeWheel = canvas.on('mouse:wheel', ({ e }: { e: WheelEvent }) => {
    e.preventDefault()
    if (e.metaKey || e.ctrlKey) {
      const zoom = Math.min(4, Math.max(0.1, canvas.getZoom() * 0.999 ** e.deltaY))
      canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom)
      setZoom(zoom)
    } else {
      canvas.relativePan(new Point(-e.deltaX, -e.deltaY))
    }
    if (wheelFrame === null) {
      wheelFrame = requestAnimationFrame(() => {
        wheelFrame = null
        canvas.requestRenderAll()
      })
    }
  })

  function setPanMode(active: boolean): void {
    if (spaceHeld === active) return
    spaceHeld = active
    canvas.defaultCursor = active ? 'grab' : 'default'
    canvas.skipTargetFind = active
    canvas.selection = !active
    canvas.setCursor(active ? 'grab' : 'default')
  }

  function isTypingTarget(): boolean {
    const element = document.activeElement as HTMLElement | null
    return Boolean(element && (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
      || element.isContentEditable
    ))
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (isTypingTarget()) return
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault()
      setPanMode(true)
    }
  }

  function handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') setPanMode(false)
  }

  const releasePanMode = () => setPanMode(false)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', releasePanMode)

  const disposeMouseDown = canvas.on('mouse:down', (event) => {
    const pointerEvent = event.e as MouseEvent | TouchEvent
    if (!('button' in pointerEvent)) return
    if (spaceHeld || pointerEvent.button === 1) {
      panning = true
      panPoint = { x: pointerEvent.clientX, y: pointerEvent.clientY }
      canvas.selection = false
      canvas.setCursor('grabbing')
    }
  })
  const disposeMouseMove = canvas.on('mouse:move', (event) => {
    if (!panning || !panPoint) return
    const pointerEvent = event.e as MouseEvent | TouchEvent
    if (!('clientX' in pointerEvent)) return
    canvas.relativePan(new Point(
      pointerEvent.clientX - panPoint.x,
      pointerEvent.clientY - panPoint.y,
    ))
    panPoint = { x: pointerEvent.clientX, y: pointerEvent.clientY }
  })
  const disposeMouseUp = canvas.on('mouse:up', () => {
    if (!panning) return
    panning = false
    panPoint = null
    canvas.selection = !spaceHeld
    canvas.setCursor(spaceHeld ? 'grab' : 'default')
  })

  const resizeObserver = new ResizeObserver((entries) => {
    const size = entries[0]?.contentRect
    if (!size || size.width < 1 || size.height < 1) return
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      canvas.setDimensions({ width: Math.floor(size.width), height: Math.floor(size.height) })
      recenter()
      canvas.requestRenderAll()
    }, 80)
  })
  resizeObserver.observe(container)

  const unsubscribeProject = subscribeProject((project, previous) => {
    // Le premier renommage fait apparaître la rangée de libellés, le dernier la
    // fait disparaître : la bande change de hauteur sans que le conteneur bouge,
    // exactement comme un drawer qui s'ouvre. Sans ce recentrage la dernière
    // planche passait sous la pellicule.
    if (hasLabelRow(project) !== hasLabelRow(previous)) {
      recenter()
      canvas.requestRenderAll()
      return
    }
    const activeScreenId = project?.activeScreenId
    if (!activeScreenId || activeScreenId === previous?.activeScreenId) return
    if (selectionFromCanvas.current) {
      selectionFromCanvas.current = false
      return
    }
    const screenIndex = project.screens.findIndex((screen) => screen.id === activeScreenId)
    if (screenIndex === -1) return
    const { insets, width, height } = availableStage()
    const padding = 48
    const zoom = Math.min(
      (width - padding * 2) / SCREEN_WIDTH,
      (height - padding * 2) / SCREEN_HEIGHT,
      1,
    )
    const screenCenterX = getScreenOffset(screenIndex) + SCREEN_WIDTH / 2
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      insets.left + width / 2 - screenCenterX * zoom,
      insets.top + (height - SCREEN_HEIGHT * zoom) / 2,
    ])
    setZoom(zoom)
    canvas.requestRenderAll()
  })

  const unsubscribeUi = subscribeUi((state, previous) => {
    if (state.viewportResetKey !== previous.viewportResetKey) {
      fitAll()
      canvas.requestRenderAll()
      return
    }
    // Un drawer qui s'ouvre change la zone libre sans changer la taille du
    // conteneur : le `ResizeObserver` ne voit rien, et la première comme la
    // dernière planche se retrouvaient à moitié sous un panneau.
    if (state.layersOpen !== previous.layersOpen || state.propsOpen !== previous.propsOpen) {
      recenter()
      canvas.requestRenderAll()
      return
    }
    if (state.zoom === previous.zoom || Math.abs(canvas.getZoom() - state.zoom) < 0.0001) return
    canvas.zoomToPoint(canvas.getVpCenter(), state.zoom)
    canvas.requestRenderAll()
  })

  function cleanup(): void {
    disposeWheel()
    disposeMouseDown()
    disposeMouseMove()
    disposeMouseUp()
    unsubscribeProject()
    unsubscribeUi()
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', releasePanMode)
    resizeObserver.disconnect()
    if (resizeTimer) clearTimeout(resizeTimer)
    if (wheelFrame !== null) cancelAnimationFrame(wheelFrame)
  }

  return { fitAll, cleanup }
}
