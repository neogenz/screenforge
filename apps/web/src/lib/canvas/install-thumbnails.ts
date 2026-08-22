import type { Canvas } from 'fabric'
import { type BoardSize, type RenderedObject } from '@/lib/canvas/canvas-utils'
import { THUMBNAIL_HEIGHT, thumbnailWidth } from '@/lib/stage'
import type { Screen } from '@/types'

interface ThumbnailInstallerOptions {
  currentCanvas: () => Canvas | null
  onGenerated: (thumbnails: Readonly<Record<string, string>>) => void
}

export interface ThumbnailScheduler {
  schedule: (screens: Screen[], board: BoardSize) => void
  cleanup: () => void
}

export function installThumbnails({
  currentCanvas,
  onGenerated,
}: ThumbnailInstallerOptions): ThumbnailScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null
  let cancelIdle: (() => void) | null = null
  let generation = 0

  function capture(screens: Screen[], board: BoardSize, expectedGeneration: number): void {
    cancelIdle = null
    const canvas = currentCanvas()
    if (!canvas || expectedGeneration !== generation) return
    const backgrounds = (canvas.getObjects() as RenderedObject[]).filter(
      (object) => object.data?.rendererType === 'background',
    )
    if (backgrounds.length === 0) return

    const savedViewport = [...canvas.viewportTransform] as typeof canvas.viewportTransform
    const thumbnails: Record<string, string> = {}

    // `renderCanvas` dessine les poignées dans le contexte du bas, celui que
    // l'on recopie : le cadre de sélection se retrouvait cuit dans l'aperçu de
    // l'écran courant. Fabric réserve ce drapeau à ce cas précis, « avoid
    // toDataURL to export controls », et une capture est un export. Il est
    // `protected` côté types seulement. L'écarter en vidant la sélection ferait
    // au contraire remonter un `selection:cleared` jusqu'au panneau.
    const controlHost = canvas as Canvas & { skipControlsDrawing: boolean }
    const savedSkipControls = controlHost.skipControlsDrawing
    controlHost.skipControlsDrawing = true

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
      // Taillé pour la tuile qui l'affiche, au double pour un écran à 2 dpr.
      // Le facteur 0,2 donnait 88x191 pour une tuile rendue 106x232 en pixels
      // physiques : l'aperçu était agrandi, donc mou. Le rapport de la tuile
      // n'est pas exactement celui de la planche (arrondi au pixel entier), et
      // c'est ce rapport-là qui prime — sinon `object-cover` en rogne l'écart.
      const renderedThumbnailWidth = thumbnailWidth(board) * 2
      const thumbnailHeight = THUMBNAIL_HEIGHT * 2

      for (const screen of screens) {
        if (expectedGeneration !== generation) return
        const background = backgrounds.find(
          (object) => object.data?.uid === `background:${screen.id}`,
        )
        if (!background) continue
        const { tl, br } = background.aCoords
        const crop = document.createElement('canvas')
        crop.width = renderedThumbnailWidth
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
          renderedThumbnailWidth,
          thumbnailHeight,
        )
        thumbnails[screen.id] = crop.toDataURL('image/png')
      }
    } catch (error) {
      console.error('Could not generate screen thumbnails.', error)
    } finally {
      controlHost.skipControlsDrawing = savedSkipControls
      canvas.setViewportTransform(savedViewport)
      canvas.renderAll()
    }

    if (expectedGeneration === generation) onGenerated(thumbnails)
  }

  function schedule(screens: Screen[], board: BoardSize): void {
    if (timer) clearTimeout(timer)
    cancelIdle?.()
    const expectedGeneration = ++generation
    timer = setTimeout(() => {
      timer = null
      if (typeof requestIdleCallback === 'function') {
        const idleId = requestIdleCallback(() => capture(screens, board, expectedGeneration), {
          timeout: 1200,
        })
        cancelIdle = () => cancelIdleCallback(idleId)
      } else {
        const idleId = setTimeout(() => capture(screens, board, expectedGeneration), 0)
        cancelIdle = () => clearTimeout(idleId)
      }
    }, 300)
  }

  function cleanup(): void {
    generation += 1
    if (timer) clearTimeout(timer)
    cancelIdle?.()
    timer = null
    cancelIdle = null
  }

  return { schedule, cleanup }
}
