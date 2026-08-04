import { ActiveSelection, Canvas, FabricObject } from 'fabric'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  getScreenOffset,
  type RenderedObject,
} from '@/lib/canvas/canvas-utils'
import type { Box, Guide } from '@/lib/snapping'
import type { Project, Screen } from '@/types'

export interface ChromeColors {
  label: string
  artboardRing: string
  activeRing: string
  selection: string
  selectionSoft: string
}

export function readChromeColors(): ChromeColors {
  const styles = getComputedStyle(document.documentElement)
  const read = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback
  return {
    label: read('--color-muted-foreground', '#b8b8b8'),
    artboardRing: read('--color-artboard-ring', 'rgba(255,255,255,0.12)'),
    activeRing: read('--color-artboard-ring-active', 'rgba(255,255,255,0.5)'),
    selection: read('--color-foreground', '#f7f7f7'),
    selectionSoft: read('--color-selection-soft', 'rgba(255,255,255,0.14)'),
  }
}

export function applyLassoColors(canvas: Canvas, chrome: ChromeColors): void {
  canvas.selectionColor = chrome.selectionSoft
  canvas.selectionBorderColor = chrome.selection
  canvas.selectionLineWidth = 1
}

export const SNAP_DISTANCE_PX = 6
const GUIDE_COLOR = '#ff2d6f'

export function boxOf(object: FabricObject): Box {
  object.setCoords()
  const { left, top, width, height } = object.getBoundingRect()
  return { left, top, width, height }
}

export function collectSnapTargets(canvas: Canvas, moving: FabricObject): Box[] {
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

export function screenIndexAtPoint(
  screens: Screen[],
  point: { x: number; y: number },
): number | null {
  if (point.y < 0 || point.y > SCREEN_HEIGHT) return null
  const index = screens.findIndex((_, screenIndex) => {
    const left = getScreenOffset(screenIndex)
    return point.x >= left && point.x <= left + SCREEN_WIDTH
  })
  return index === -1 ? null : index
}

export function drawGuides(canvas: Canvas, guides: Guide[]): void {
  const ctx = canvas.contextTop
  const retina = canvas.getRetinaScaling()
  const [zoomX, , , zoomY, panX, panY] = canvas.viewportTransform
  ctx.save()
  ctx.setTransform(retina, 0, 0, retina, 0, 0)
  ctx.strokeStyle = GUIDE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const guide of guides) {
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
  canvas.contextTopDirty = true
}

export interface SelectionFrame {
  left: number
  top: number
  width: number
  height: number
  stageWidth: number
  stageHeight: number
}

export function readSelectionFrame(canvas: Canvas): SelectionFrame | null {
  const active = canvas.getActiveObject() as RenderedObject | null
  if (!active) return null
  active.setCoords()
  const bounds = active.getBoundingRect()
  let left = bounds.left
  let right = bounds.left + bounds.width
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

export function sameFrame(left: SelectionFrame | null, right: SelectionFrame | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return Math.round(left.left) === Math.round(right.left)
    && Math.round(left.top) === Math.round(right.top)
    && Math.round(left.width) === Math.round(right.width)
    && Math.round(left.height) === Math.round(right.height)
    && left.stageWidth === right.stageWidth
    && left.stageHeight === right.stageHeight
}

export function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export function resolveSelectionObjects(
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
