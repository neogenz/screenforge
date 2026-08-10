import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import { MAX_SCREENSHOT_ZOOM, MIN_SCREENSHOT_ZOOM } from '@/lib/screenshot-placement'
import { SAFE_SLOT } from '@/lib/slots'
import { ICON_BOX, isIconId, isShapeId } from '@/lib/vector-catalog'
import type { Layer, Project } from '@/types'

const SAFE_ASSET_ID = /^[a-zA-Z0-9_-]{1,128}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown, minimum = -Infinity, maximum = Infinity): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isColorStops(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every(
      (stop) =>
        isRecord(stop) && isFiniteNumber(stop.offset, 0, 1) && typeof stop.color === 'string',
    )
  )
}

function isGradient(value: unknown): boolean {
  if (!isRecord(value) || !['linear', 'radial'].includes(String(value.type))) return false
  if (!isColorStops(value.stops)) return false
  if (value.angle !== undefined && !isFiniteNumber(value.angle)) return false
  if (value.centerX !== undefined && !isFiniteNumber(value.centerX, 0, 100)) return false
  if (value.centerY !== undefined && !isFiniteNumber(value.centerY, 0, 100)) return false
  return true
}

function isBackground(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.type === 'solid') return typeof value.color === 'string'
  if (value.type === 'linear-gradient') {
    return isFiniteNumber(value.angle) && isColorStops(value.stops)
  }
  if (value.type !== 'radial-gradient' || !isColorStops(value.stops)) return false
  if (value.centerX !== undefined && !isFiniteNumber(value.centerX, 0, 100)) return false
  if (value.centerY !== undefined && !isFiniteNumber(value.centerY, 0, 100)) return false
  return true
}

function isShadow(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.offsetX) &&
    isFiniteNumber(value.offsetY) &&
    isFiniteNumber(value.blur, 0) &&
    typeof value.color === 'string'
  )
}

function isBaseLayer(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string' &&
    Boolean(value.id) &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width, Number.EPSILON) &&
    isFiniteNumber(value.height, Number.EPSILON) &&
    isFiniteNumber(value.rotation) &&
    isFiniteNumber(value.opacity, 0, 1) &&
    typeof value.locked === 'boolean' &&
    typeof value.visible === 'boolean' &&
    Number.isSafeInteger(value.zIndex) &&
    (value.scope === undefined || value.scope === 'layout') &&
    !('src' in value) &&
    !('screenshotUrl' in value)
  )
}

function isScreenshotSize(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.width, 1) && isFiniteNumber(value.height, 1)
}

function isScreenshotPlacement(value: unknown): boolean {
  return (
    isRecord(value) &&
    ['cover', 'contain', 'fill'].includes(String(value.mode)) &&
    isFiniteNumber(value.focusX, 0, 1) &&
    isFiniteNumber(value.focusY, 0, 1) &&
    isFiniteNumber(value.zoom, MIN_SCREENSHOT_ZOOM, MAX_SCREENSHOT_ZOOM)
  )
}

function isImportedBezel(value: unknown): boolean {
  if (!isRecord(value) || !SAFE_ASSET_ID.test(String(value.assetId))) return false
  if (typeof value.fileName !== 'string' || !value.fileName) return false
  if (!isFiniteNumber(value.naturalWidth, 1) || !isFiniteNumber(value.naturalHeight, 1))
    return false
  const screen = value.screen
  return (
    isRecord(screen) &&
    isFiniteNumber(screen.x, 0) &&
    isFiniteNumber(screen.y, 0) &&
    isFiniteNumber(screen.width, 1) &&
    isFiniteNumber(screen.height, 1) &&
    screen.x + screen.width <= value.naturalWidth &&
    screen.y + screen.height <= value.naturalHeight
  )
}

function isLayer(value: unknown, scope: 'screen' | 'layout'): value is Layer {
  if (!isRecord(value) || !isBaseLayer(value)) return false
  if (scope === 'layout' ? value.scope !== 'layout' : value.scope !== undefined) return false

  if (value.type === 'image') {
    return (
      SAFE_ASSET_ID.test(String(value.assetId)) &&
      isFiniteNumber(value.originalWidth, 1) &&
      isFiniteNumber(value.originalHeight, 1) &&
      (value.shadow === undefined || isShadow(value.shadow))
    )
  }
  if (value.type === 'device-frame') {
    if (typeof value.deviceModel !== 'string' || !value.deviceModel) return false
    if (typeof value.deviceColor !== 'string' || !value.deviceColor) return false
    if (!['portrait', 'landscape'].includes(String(value.orientation))) return false
    if (
      value.screenshotAssetId !== undefined &&
      !SAFE_ASSET_ID.test(String(value.screenshotAssetId))
    )
      return false
    if (value.importedBezel !== undefined && !isImportedBezel(value.importedBezel)) return false
    if (value.screenshotSize !== undefined && !isScreenshotSize(value.screenshotSize)) return false
    if (value.placement !== undefined && !isScreenshotPlacement(value.placement)) return false
    if (value.slot !== undefined && !SAFE_SLOT.test(String(value.slot))) return false
    if (value.shadowEnabled !== undefined && typeof value.shadowEnabled !== 'boolean') return false
    if (value.shadowBlur !== undefined && !isFiniteNumber(value.shadowBlur, 0)) return false
    if (value.shadowColor !== undefined && typeof value.shadowColor !== 'string') return false
    if (value.shadowOffsetX !== undefined && !isFiniteNumber(value.shadowOffsetX)) return false
    if (value.shadowOffsetY !== undefined && !isFiniteNumber(value.shadowOffsetY)) return false
    return true
  }
  if (value.type === 'text') {
    return (
      typeof value.content === 'string' &&
      typeof value.fontFamily === 'string' &&
      Boolean(value.fontFamily) &&
      isFiniteNumber(value.fontSize, 1) &&
      isFiniteNumber(value.fontWeight, 1) &&
      typeof value.color === 'string' &&
      ['left', 'center', 'right'].includes(String(value.textAlign)) &&
      isFiniteNumber(value.lineHeight, Number.EPSILON) &&
      isFiniteNumber(value.letterSpacing) &&
      ['none', 'uppercase', 'lowercase', 'capitalize'].includes(String(value.textTransform)) &&
      (value.shadow === undefined || isShadow(value.shadow)) &&
      (value.gradientFill === undefined || isGradient(value.gradientFill))
    )
  }
  if (value.type === 'icon') {
    return (
      isIconId(value.iconId) &&
      typeof value.color === 'string' &&
      Boolean(value.color) &&
      (value.strokeWidth === undefined || isFiniteNumber(value.strokeWidth, 0, ICON_BOX)) &&
      (value.shadow === undefined || isShadow(value.shadow))
    )
  }
  if (value.type !== 'shape' || 'gradientFill' in value) return false
  if (!isShapeId(value.shapeType)) return false
  if (!(typeof value.fill === 'string' || isGradient(value.fill))) return false
  if (value.stroke !== undefined && typeof value.stroke !== 'string') return false
  if (value.strokeWidth !== undefined && !isFiniteNumber(value.strokeWidth, 0)) return false
  if (value.borderRadius !== undefined && !isFiniteNumber(value.borderRadius, 0)) return false
  return value.shadow === undefined || isShadow(value.shadow)
}

/** Strict current project contract shared by every persistence boundary. */
export function isProject(value: unknown): value is Project {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return false
  if (typeof value.name !== 'string' || typeof value.activeScreenId !== 'string') return false
  if (!Array.isArray(value.screens) || !Array.isArray(value.layoutLayers)) return false
  if (
    !isRecord(value.globals) ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return false
  }
  if (value.screens.length < 1 || value.screens.length > MAX_PROJECT_SCREENS) return false
  const globals = value.globals
  if (
    typeof globals.fontFamily !== 'string' ||
    !globals.fontFamily ||
    !isFiniteNumber(globals.fontWeight, 1) ||
    !isFiniteNumber(globals.fontSize, 1) ||
    typeof globals.fontColor !== 'string' ||
    !isBackground(globals.background) ||
    typeof globals.deviceModel !== 'string' ||
    !globals.deviceModel ||
    typeof globals.deviceColor !== 'string' ||
    !globals.deviceColor
  )
    return false

  const screenIds = new Set<string>()
  const layerIds = new Set<string>()
  for (const screen of value.screens) {
    if (!isRecord(screen) || typeof screen.id !== 'string' || !screen.id) return false
    if (screenIds.has(screen.id) || typeof screen.name !== 'string') return false
    if (!Array.isArray(screen.layers) || !isBackground(screen.background)) return false
    if (screen.thumbnail !== undefined && typeof screen.thumbnail !== 'string') return false
    screenIds.add(screen.id)
    for (const layer of screen.layers) {
      if (!isLayer(layer, 'screen') || layerIds.has(layer.id)) return false
      layerIds.add(layer.id)
    }
  }
  for (const layer of value.layoutLayers) {
    if (!isLayer(layer, 'layout') || layerIds.has(layer.id)) return false
    layerIds.add(layer.id)
  }
  return screenIds.has(value.activeScreenId)
}

/** Pure, idempotent migrations for legacy graph fields that carry no binary data. */
export function migrateProject(value: unknown): unknown {
  const project = structuredClone(value)
  if (!isRecord(project)) return project
  const collections = [
    ...(Array.isArray(project.screens)
      ? project.screens.flatMap((screen) =>
          isRecord(screen) && Array.isArray(screen.layers) ? [screen.layers] : [],
        )
      : []),
    ...(Array.isArray(project.layoutLayers) ? [project.layoutLayers] : []),
  ]
  for (const layers of collections) {
    for (const layer of layers) {
      if (!isRecord(layer)) continue
      if (layer.type === 'shape' && isGradient(layer.gradientFill)) {
        layer.fill = layer.gradientFill
        delete layer.gradientFill
      }
      if (layer.type === 'device-frame' && layer.importedBezel !== undefined) {
        layer.orientation = 'portrait'
      }
    }
  }
  return project
}
