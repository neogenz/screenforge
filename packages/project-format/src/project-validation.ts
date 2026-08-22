import {
  DEFAULT_APP_STORE_PROFILE_ID,
  isAppStoreProfileId,
  MAX_PROJECT_SCREENS,
} from './dimensions.ts'
import { MAX_SCREENSHOT_ZOOM, MIN_SCREENSHOT_ZOOM } from './screenshot-placement.ts'
import { SAFE_SLOT } from './slots.ts'
import { isTextCharStyles } from './text-char-styles.ts'
import { ICON_BOX, isIconId, isShapeId } from './catalog-ids.ts'
import type { Layer, Project, ScriptId } from './types.ts'

const SAFE_ASSET_ID = /^[a-zA-Z0-9_-]{1,128}$/
export const MAX_PROJECT_LAYERS = 500
export const MAX_PROJECT_NAME_LENGTH = 256
export const MAX_LAYER_TEXT_LENGTH = 10_000
export const MAX_GRADIENT_STOPS = 32
export const MAX_STYLE_STRING_LENGTH = 256
const MAX_SCENE_COORDINATE = 1_000_000
const MAX_SCENE_SIZE = 1_000_000

function isBoundedString(value: unknown, maximum = MAX_PROJECT_NAME_LENGTH): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function isStyleString(value: unknown): value is string {
  return isBoundedString(value, MAX_STYLE_STRING_LENGTH)
}

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
    value.length <= MAX_GRADIENT_STOPS &&
    value.every(
      (stop) => isRecord(stop) && isFiniteNumber(stop.offset, 0, 1) && isStyleString(stop.color),
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

/** Exporté pour que le plan d'un fournisseur soit jugé sur le même contrat. */
export function isBackground(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.type === 'solid') return isStyleString(value.color)
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
    isStyleString(value.color)
  )
}

function isBaseLayer(value: Record<string, unknown>): boolean {
  return (
    isBoundedString(value.id, 128) &&
    isBoundedString(value.name) &&
    isFiniteNumber(value.x, -MAX_SCENE_COORDINATE, MAX_SCENE_COORDINATE) &&
    isFiniteNumber(value.y, -MAX_SCENE_COORDINATE, MAX_SCENE_COORDINATE) &&
    isFiniteNumber(value.width, Number.EPSILON, MAX_SCENE_SIZE) &&
    isFiniteNumber(value.height, Number.EPSILON, MAX_SCENE_SIZE) &&
    isFiniteNumber(value.rotation, -36_000, 36_000) &&
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
      value.content.length <= MAX_LAYER_TEXT_LENGTH &&
      isBoundedString(value.fontFamily) &&
      isFiniteNumber(value.fontSize, 1, 10_000) &&
      isFiniteNumber(value.fontWeight, 1) &&
      isStyleString(value.color) &&
      ['left', 'center', 'right'].includes(String(value.textAlign)) &&
      isFiniteNumber(value.lineHeight, Number.EPSILON) &&
      isFiniteNumber(value.letterSpacing) &&
      ['none', 'uppercase', 'lowercase', 'capitalize'].includes(String(value.textTransform)) &&
      (value.shadow === undefined || isShadow(value.shadow)) &&
      (value.gradientFill === undefined || isGradient(value.gradientFill)) &&
      (value.charStyles === undefined || isTextCharStyles(value.charStyles))
    )
  }
  if (value.type === 'icon') {
    return (
      isIconId(value.iconId) &&
      isStyleString(value.color) &&
      (value.strokeWidth === undefined || isFiniteNumber(value.strokeWidth, 0, ICON_BOX)) &&
      (value.shadow === undefined || isShadow(value.shadow))
    )
  }
  if (value.type !== 'shape' || 'gradientFill' in value) return false
  if (!isShapeId(value.shapeType)) return false
  if (!(isStyleString(value.fill) || isGradient(value.fill))) return false
  if (value.stroke !== undefined && !isStyleString(value.stroke)) return false
  if (value.strokeWidth !== undefined && !isFiniteNumber(value.strokeWidth, 0)) return false
  if (value.borderRadius !== undefined && !isFiniteNumber(value.borderRadius, 0)) return false
  return value.shadow === undefined || isShadow(value.shadow)
}

/** Strict current project contract shared by every persistence boundary. */
/**
 * Les limites d'un projet, posées ici et pas dans `release.ts`.
 *
 * La validation tourne à chaque transaction et se veut légère ; `release.ts`
 * tire le moteur de rendu derrière lui. La dépendance va donc du lourd vers le
 * léger, jamais l'inverse.
 */
export const MAX_PROJECT_RELEASES = 20
export const MAX_RELEASE_NAME_LENGTH = 64

export const MAX_PROJECT_LOCALES = 12
export const MAX_LOCALE_NAME_LENGTH = 40
export const MAX_LOCALE_TEXT_LENGTH = 400

/** BCP-47 court : `ja`, `pt-BR`. C'est aussi le nom du dossier d'export. */
export const LOCALE_CODE = /^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/

/**
 * Les scripts d'écriture reconnus, déclarés ici parce que la validation doit
 * rester légère : `lib/locale.ts` leur attache des polices et tire le
 * catalogue derrière lui. La dépendance va du lourd vers le léger.
 */
export const SCRIPT_IDS = [
  'latin',
  'cyrillic',
  'greek',
  'japanese',
  'korean',
  'simplified-chinese',
  'arabic',
  'hebrew',
  'devanagari',
  'thai',
] as const satisfies readonly ScriptId[]

const SHA256_HEX = /^[a-f0-9]{64}$/

function isGlobals(value: unknown): boolean {
  return (
    isRecord(value) &&
    isBoundedString(value.fontFamily) &&
    isFiniteNumber(value.fontWeight, 1) &&
    isFiniteNumber(value.fontSize, 1) &&
    isStyleString(value.fontColor) &&
    isBackground(value.background) &&
    typeof value.deviceModel === 'string' &&
    Boolean(value.deviceModel) &&
    typeof value.deviceColor === 'string' &&
    Boolean(value.deviceColor)
  )
}

/**
 * La scène : les écrans et les calques partagés.
 *
 * `Project` et `ProjectSnapshot` la portent tous les deux, et une release
 * invalide doit être rejetée aussi sévèrement qu'un projet invalide — c'est
 * elle qu'on rejouera pour vérifier le lot. Rend les identifiants d'écran,
 * dont l'appelant a besoin pour valider `activeScreenId`.
 */
function sceneScreenIds(screens: unknown, layoutLayers: unknown): Set<string> | null {
  if (!Array.isArray(screens) || !Array.isArray(layoutLayers)) return null
  if (screens.length < 1 || screens.length > MAX_PROJECT_SCREENS) return null

  const screenIds = new Set<string>()
  const layerIds = new Set<string>()
  for (const screen of screens) {
    if (!isRecord(screen) || !isBoundedString(screen.id, 128)) return null
    if (screenIds.has(screen.id) || !isBoundedString(screen.name)) return null
    if (!Array.isArray(screen.layers) || !isBackground(screen.background)) return null
    if (screen.layers.length > MAX_PROJECT_LAYERS) return null
    if (screen.thumbnail !== undefined && typeof screen.thumbnail !== 'string') return null
    screenIds.add(screen.id)
    for (const layer of screen.layers) {
      if (!isLayer(layer, 'screen') || layerIds.has(layer.id)) return null
      layerIds.add(layer.id)
      if (layerIds.size > MAX_PROJECT_LAYERS) return null
    }
  }
  if (layoutLayers.length > MAX_PROJECT_LAYERS) return null
  for (const layer of layoutLayers) {
    if (!isLayer(layer, 'layout') || layerIds.has(layer.id)) return null
    layerIds.add(layer.id)
    if (layerIds.size > MAX_PROJECT_LAYERS) return null
  }
  return screenIds
}

function isReleaseFile(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    Boolean(value.path) &&
    typeof value.screenId === 'string' &&
    isFiniteNumber(value.width, 1) &&
    isFiniteNumber(value.height, 1) &&
    isFiniteNumber(value.byteLength, 0) &&
    typeof value.sha256 === 'string' &&
    SHA256_HEX.test(value.sha256)
  )
}

function isRelease(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || !value.id) return false
  if (typeof value.name !== 'string' || value.name.length > MAX_RELEASE_NAME_LENGTH) return false
  if (!isFiniteNumber(value.createdAt) || typeof value.watermarked !== 'boolean') return false
  if (
    value.locale !== undefined &&
    (typeof value.locale !== 'string' || !LOCALE_CODE.test(value.locale))
  )
    return false
  if (!Array.isArray(value.files) || !value.files.every(isReleaseFile)) return false

  const snapshot = value.snapshot
  if (!isRecord(snapshot) || typeof snapshot.name !== 'string') return false
  if (!isAppStoreProfileId(snapshot.profileId)) return false
  if (!isGlobals(snapshot.globals)) return false
  return sceneScreenIds(snapshot.screens, snapshot.layoutLayers) !== null
}

/**
 * Une variante de langue.
 *
 * Elle ne porte que des textes : aucun identifiant de calque n'est exigé
 * d'exister, parce qu'un calque supprimé ne doit pas rendre le projet entier
 * invalide — l'entrée orpheline est simplement ignorée à la substitution. Ce
 * qui est vérifié, c'est la forme et les bornes.
 */
function isLocaleVariant(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.code !== 'string' || !LOCALE_CODE.test(value.code)) return false
  if (typeof value.name !== 'string' || value.name.length > MAX_LOCALE_NAME_LENGTH) return false
  if (!SCRIPT_IDS.includes(value.script as ScriptId)) return false
  if (value.fontFamily !== undefined && typeof value.fontFamily !== 'string') return false
  if (!isRecord(value.texts)) return false
  return Object.values(value.texts).every(
    (text) =>
      isRecord(text) &&
      typeof text.value === 'string' &&
      text.value.length <= MAX_LOCALE_TEXT_LENGTH &&
      typeof text.reviewed === 'boolean',
  )
}

export function isProject(value: unknown): value is Project {
  if (!isRecord(value) || !isBoundedString(value.id, 128)) return false
  if (!isBoundedString(value.name) || !isBoundedString(value.activeScreenId, 128)) return false
  if (!isAppStoreProfileId(value.profileId)) return false
  if (!isGlobals(value.globals)) return false
  if (!isFiniteNumber(value.createdAt) || !isFiniteNumber(value.updatedAt)) return false

  const screenIds = sceneScreenIds(value.screens, value.layoutLayers)
  if (!screenIds) return false

  if (value.releases !== undefined) {
    if (!Array.isArray(value.releases) || value.releases.length > MAX_PROJECT_RELEASES) return false
    if (!value.releases.every(isRelease)) return false
  }

  if (value.locales !== undefined) {
    if (!Array.isArray(value.locales) || value.locales.length > MAX_PROJECT_LOCALES) return false
    if (!value.locales.every(isLocaleVariant)) return false
    const codes = new Set(value.locales.map((locale) => (locale as { code: string }).code))
    if (codes.size !== value.locales.length) return false
  }

  return screenIds.has(value.activeScreenId)
}

/** Pure, idempotent migrations for legacy graph fields that carry no binary data. */
export function migrateProject(value: unknown): unknown {
  const project = structuredClone(value)
  if (!isRecord(project)) return project
  project.profileId ??= DEFAULT_APP_STORE_PROFILE_ID
  if (Array.isArray(project.releases)) {
    for (const release of project.releases) {
      if (isRecord(release) && isRecord(release.snapshot)) {
        release.snapshot.profileId ??= DEFAULT_APP_STORE_PROFILE_ID
      }
    }
  }
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
