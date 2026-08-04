import type { Canvas } from 'fabric'
import { SCREEN_HEIGHT, SCREEN_WIDTH, type RenderedObject } from '@/lib/canvas/canvas-utils'
import type { Screen } from '@/types'

interface ThumbnailInstallerOptions {
  currentCanvas: () => Canvas | null
  onGenerated: (thumbnails: Readonly<Record<string, string>>) => void
}

export interface ThumbnailScheduler {
  schedule: (screens: Screen[]) => void
  cleanup: () => void
}

export function installThumbnails({
  currentCanvas,
  onGenerated,
}: ThumbnailInstallerOptions): ThumbnailScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null
  let cancelIdle: (() => void) | null = null
  let generation = 0

  function capture(screens: Screen[], expectedGeneration: number): void {
    cancelIdle = null
    const canvas = currentCanvas()
    if (!canvas || expectedGeneration !== generation) return
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
        if (expectedGeneration !== generation) return
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

    if (expectedGeneration === generation) onGenerated(thumbnails)
  }

  function schedule(screens: Screen[]): void {
    if (timer) clearTimeout(timer)
    cancelIdle?.()
    const expectedGeneration = ++generation
    timer = setTimeout(() => {
      timer = null
      if (typeof requestIdleCallback === 'function') {
        const idleId = requestIdleCallback(
          () => capture(screens, expectedGeneration),
          { timeout: 1200 },
        )
        cancelIdle = () => cancelIdleCallback(idleId)
      } else {
        const idleId = setTimeout(() => capture(screens, expectedGeneration), 0)
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
