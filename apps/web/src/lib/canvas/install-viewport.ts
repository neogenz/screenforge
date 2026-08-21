import { Canvas, Point } from 'fabric'
import { getScreenOffset, getTotalWidth } from '@/lib/canvas/canvas-utils'
import { APP_STORE_PROFILE, getStoreTargetProfile } from '@/lib/dimensions'
import { stageInsets } from '@/lib/stage'
import { ZOOM_MAX, ZOOM_MIN } from '@/stores/ui.store'
import type { Project } from '@/types'

/** Pas du grain à 100 %, en accord avec `--stage-dot-step` au repos. */
const GRAIN_STEP = 22
/**
 * Bornes du pas rendu à l'écran.
 *
 * Le grain est ancré à la scène : il se dilate avec le zoom, sinon il flotterait
 * au-dessus du contenu au lieu de lui servir de sol. Dilaté sans borne il
 * devient un aplat gris à 10 % et un semis clairsemé à 400 %, d'où le doublement
 * par octaves — le motif reste périodique, donc un point tombe toujours sur
 * l'origine de la scène, seul un point sur deux disparaît.
 */
const GRAIN_MIN = 12
const GRAIN_MAX = 44

/** @param zoom facteur du viewport Fabric */
function grainStep(zoom: number): number {
  if (!(zoom > 0)) return GRAIN_STEP
  let step = GRAIN_STEP * zoom
  while (step < GRAIN_MIN) step *= 2
  while (step > GRAIN_MAX) step /= 2
  return step
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
  subscribeUi: (listener: (state: ViewportUiState, previous: ViewportUiState) => void) => () => void
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
    const insets = stageInsets({ layers: layersOpen, props: propsOpen })
    return {
      insets,
      width: Math.max(1, canvas.width - insets.left - insets.right),
      height: Math.max(1, canvas.height - insets.top - insets.bottom),
    }
  }

  function fitAll(): void {
    const project = getProject()
    const screenCount = project?.screens.length ?? 1
    const board = project ? getStoreTargetProfile(project.target).board : APP_STORE_PROFILE.board
    const { insets, width, height } = availableStage()
    const totalWidth = getTotalWidth(screenCount, board)
    const padding = 48
    /* Borné aux clamps du store : un fit sous `ZOOM_MIN` mettait le canvas à
       15 % pendant que le store affichait 25 % — HUD faux, puis saut au premier
       cran de molette. À beaucoup d'écrans sur fenêtre étroite, le fit montre
       donc une partie de la scène, panoramique à l'appui, mais un seul zoom. */
    const zoom = Math.max(
      ZOOM_MIN,
      Math.min((width - padding * 2) / totalWidth, (height - padding * 2) / board.height, 1),
    )
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      insets.left + (width - totalWidth * zoom) / 2,
      insets.top + (height - board.height * zoom) / 2,
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
    const project = getProject()
    const screenCount = project?.screens.length ?? 1
    const board = project ? getStoreTargetProfile(project.target).board : APP_STORE_PROFILE.board
    const { insets, width, height } = availableStage()
    const zoom = canvas.getZoom()
    const totalWidth = getTotalWidth(screenCount, board)

    if (totalWidth * zoom > width || board.height * zoom > height) {
      fitAll()
      return
    }

    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      insets.left + (width - totalWidth * zoom) / 2,
      insets.top + (height - board.height * zoom) / 2,
    ])
  }

  /**
   * Le grain suit la scène, écrit sur l'élément et non dans un store.
   *
   * Un panoramique change la transformation à chaque image : la passer par un
   * store ferait re-rendre React soixante fois par seconde pour deux nombres que
   * seul le CSS lit. La clé évite les écritures identiques — `after:render` tire
   * aussi sur un simple survol d'objet, où rien n'a bougé.
   */
  let grainKey = ''
  const disposeGrain = canvas.on('after:render', () => {
    const [zoom, , , , panX, panY] = canvas.viewportTransform
    const step = grainStep(zoom)
    // Le motif se répète : seule la position dans une maille compte, et la
    // ramener évite d'écrire des offsets de plusieurs milliers de pixels.
    const key = `${step} ${panX % step} ${panY % step}`
    if (key === grainKey) return
    grainKey = key
    const [size, x, y] = key.split(' ')
    container.style.setProperty('--stage-dot-step', `${size}px`)
    container.style.setProperty('--stage-dot-x', `${x}px`)
    container.style.setProperty('--stage-dot-y', `${y}px`)
  })

  /* Le zoom se borne comme le store (0.25 – 4), pas avec un plancher local de
     0.1 : descendre sous 0.25 le plaçait sur la scène pendant que le store
     restait à 0.25, et la prochaine action de zoom repartait de *sa* valeur en
     re-centrant le viewport d'un coup. Le `setZoom`, lui, ne court qu'une fois
     par trame — un pinch de trackpad à 120 Hz ne re-rend pas l'HUD 120 fois. */
  let pendingZoom: number | null = null
  const disposeWheel = canvas.on('mouse:wheel', ({ e }: { e: WheelEvent }) => {
    e.preventDefault()
    if (e.metaKey || e.ctrlKey) {
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, canvas.getZoom() * 0.999 ** e.deltaY))
      canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom)
      pendingZoom = zoom
    } else {
      canvas.relativePan(new Point(-e.deltaX, -e.deltaY))
    }
    if (wheelFrame === null) {
      wheelFrame = requestAnimationFrame(() => {
        wheelFrame = null
        if (pendingZoom !== null) {
          setZoom(pendingZoom)
          pendingZoom = null
        }
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
    return Boolean(
      element &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable),
    )
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
    canvas.relativePan(
      new Point(pointerEvent.clientX - panPoint.x, pointerEvent.clientY - panPoint.y),
    )
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
    // Plus de recentrage au renommage : la pellicule réserve ses deux rangées
    // en permanence, donc sa hauteur ne dépend plus de ce que les écrans
    // s'appellent. C'est le renommage qui faisait auparavant passer la dernière
    // planche sous la bande.
    const activeScreenId = project?.activeScreenId
    if (!activeScreenId || activeScreenId === previous?.activeScreenId) return
    if (selectionFromCanvas.current) {
      selectionFromCanvas.current = false
      return
    }
    const screenIndex = project.screens.findIndex((screen) => screen.id === activeScreenId)
    if (screenIndex === -1) return
    const board = getStoreTargetProfile(project.target).board
    const { insets, width, height } = availableStage()
    const padding = 48
    // Même borne que `fitAll` : le canvas et le store doivent lire un seul zoom.
    const zoom = Math.max(
      ZOOM_MIN,
      Math.min((width - padding * 2) / board.width, (height - padding * 2) / board.height, 1),
    )
    const screenCenterX = getScreenOffset(screenIndex, board) + board.width / 2
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      insets.left + width / 2 - screenCenterX * zoom,
      insets.top + (height - board.height * zoom) / 2,
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
    // `zoomToPoint` fige un point de l'écran, pas un point de la scène :
    // « The point won't move ». `getVpCenter()` rend l'inverse, la coordonnée de
    // scène sous le centre du canevas — à 25 % de zoom elle vaut des milliers de
    // pixels, et chaque cran de zoom repoussait les planches d'autant. Trois
    // crans suffisaient à les envoyer à 50 000px de la fenêtre.
    // Le centre de la zone libre, et non celui du canevas : c'est déjà l'ancre
    // de `fitAll` et de `recenter`, et c'est le seul point que l'utilisateur
    // voit lorsqu'un tiroir mange un tiers de la largeur.
    const { insets, width, height } = availableStage()
    canvas.zoomToPoint(new Point(insets.left + width / 2, insets.top + height / 2), state.zoom)
    canvas.requestRenderAll()
  })

  function cleanup(): void {
    disposeGrain()
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
