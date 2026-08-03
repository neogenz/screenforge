import JSZip, { type JSZipObject } from 'jszip'
import { resolveAsset } from '@/lib/assets'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import type { Layer, Project } from '@/types'

export const PROJECT_FILE_EXTENSION = '.screenforge.zip'
export const PROJECT_FILE_MIME = 'application/zip'
export const MAX_PROJECT_FILE_BYTES = 256 * 1024 * 1024
export const MAX_PROJECT_ASSET_BYTES = 64 * 1024 * 1024
export const MAX_PROJECT_TOTAL_ASSET_BYTES = 256 * 1024 * 1024
export const MAX_PROJECT_FILE_ENTRIES = 128

const PROJECT_FILE_FORMAT = 'screenforge-project'
const PROJECT_FILE_VERSION = 1
const MANIFEST_PATH = 'project.json'
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024
const SAFE_ASSET_ID = /^[a-zA-Z0-9_-]{1,128}$/
const SAFE_ASSET_PATH = /^assets\/[a-zA-Z0-9_-]{1,128}\.(?:png|jpg|svg)$/
const SHA256 = /^[a-f0-9]{64}$/
const ZIP_DATE = new Date('1980-01-01T00:00:00.000Z')

const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
} as const

type AssetMimeType = keyof typeof MIME_EXTENSIONS

export type ProjectFileErrorCode =
  | 'file-too-large'
  | 'invalid-archive'
  | 'invalid-manifest'
  | 'unsupported-version'
  | 'unsafe-entry'
  | 'missing-asset'
  | 'asset-too-large'
  | 'corrupt-asset'
  | 'missing-current-asset'

export class ProjectFileError extends Error {
  constructor(public readonly code: ProjectFileErrorCode) {
    super(code)
    this.name = 'ProjectFileError'
  }
}

const ERROR_MESSAGES: Record<ProjectFileErrorCode, string> = {
  'file-too-large': 'Le fichier projet est trop volumineux.',
  'invalid-archive': 'Archive projet invalide.',
  'invalid-manifest': 'Le manifeste du projet est invalide.',
  'unsupported-version': 'Cette version de projet ScreenForge n’est pas prise en charge.',
  'unsafe-entry': 'L’archive contient un chemin non autorisé.',
  'missing-asset': 'Un asset du projet est manquant.',
  'asset-too-large': 'Un asset du projet est trop volumineux.',
  'corrupt-asset': 'Un asset du projet est corrompu.',
  'missing-current-asset': 'Le projet ouvert référence un asset introuvable.',
}

export function projectFileErrorMessage(error: unknown): string {
  return error instanceof ProjectFileError
    ? ERROR_MESSAGES[error.code]
    : 'Échec inattendu du fichier projet.'
}

interface ProjectAssetDescriptor {
  id: string
  path: string
  mimeType: AssetMimeType
  byteLength: number
  sha256: string
}

interface ProjectFileManifest {
  format: typeof PROJECT_FILE_FORMAT
  version: typeof PROJECT_FILE_VERSION
  project: Project
  assets: ProjectAssetDescriptor[]
}

export interface DecodedProjectFile {
  project: Project
  assets: Array<{ id: string; dataUrl: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assetPath(id: string, mimeType: AssetMimeType): string {
  return `assets/${id}.${MIME_EXTENSIONS[mimeType]}`
}

function isAssetMimeType(value: unknown): value is AssetMimeType {
  return typeof value === 'string' && value in MIME_EXTENSIONS
}

function layersOf(project: Project): Layer[] {
  return [...project.layoutLayers, ...project.screens.flatMap((screen) => screen.layers)]
}

export function collectProjectAssetIds(project: Project): string[] {
  const ids = new Set<string>()
  for (const layer of layersOf(project)) {
    if (layer.type === 'image') ids.add(layer.assetId)
    if (layer.type !== 'device-frame') continue
    if (layer.screenshotAssetId) ids.add(layer.screenshotAssetId)
    if (layer.importedBezel?.assetId) ids.add(layer.importedBezel.assetId)
  }
  return [...ids].sort()
}

function projectWithoutThumbnails(project: Project): Project {
  return {
    ...structuredClone(project),
    screens: project.screens.map((screen) => {
      const copy = structuredClone(screen)
      delete copy.thumbnail
      return copy
    }),
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const input = Uint8Array.from(bytes)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function dataUrlBytes(dataUrl: string): Promise<{ mimeType: AssetMimeType; bytes: Uint8Array }> {
  if (!dataUrl.startsWith('data:')) throw new ProjectFileError('missing-current-asset')
  const blob = await (await fetch(dataUrl)).blob()
  if (!isAssetMimeType(blob.type)) throw new ProjectFileError('invalid-manifest')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.byteLength === 0) throw new ProjectFileError('invalid-manifest')
  if (bytes.byteLength > MAX_PROJECT_ASSET_BYTES) throw new ProjectFileError('asset-too-large')
  return { mimeType: blob.type, bytes }
}

function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new ProjectFileError('corrupt-asset'))
    reader.onerror = () => reject(new ProjectFileError('corrupt-asset'))
    reader.readAsDataURL(blob)
  })
}

export async function createProjectFile(project: Project): Promise<Blob> {
  const ids = collectProjectAssetIds(project)
  if (ids.length > MAX_PROJECT_FILE_ENTRIES - 1) throw new ProjectFileError('invalid-manifest')
  const assets = await Promise.all(ids.map(async (id) => {
    if (!SAFE_ASSET_ID.test(id)) throw new ProjectFileError('invalid-manifest')
    const dataUrl = resolveAsset(id)
    if (!dataUrl) throw new ProjectFileError('missing-current-asset')
    const { mimeType, bytes } = await dataUrlBytes(dataUrl)
    return {
      descriptor: {
        id,
        path: assetPath(id, mimeType),
        mimeType,
        byteLength: bytes.byteLength,
        sha256: await sha256(bytes),
      } satisfies ProjectAssetDescriptor,
      bytes,
    }
  }))
  const totalBytes = assets.reduce((total, asset) => total + asset.bytes.byteLength, 0)
  if (totalBytes > MAX_PROJECT_TOTAL_ASSET_BYTES) throw new ProjectFileError('asset-too-large')

  const manifest: ProjectFileManifest = {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    project: projectWithoutThumbnails(project),
    assets: assets.map(({ descriptor }) => descriptor),
  }
  const manifestJson = JSON.stringify(manifest, null, 2)
  if (new TextEncoder().encode(manifestJson).byteLength > MAX_MANIFEST_BYTES) {
    throw new ProjectFileError('invalid-manifest')
  }

  const zip = new JSZip()
  zip.file(MANIFEST_PATH, manifestJson, { date: ZIP_DATE })
  for (const { descriptor, bytes } of assets) {
    zip.file(descriptor.path, bytes, { binary: true, date: ZIP_DATE, createFolders: false })
  }
  return zip.generateAsync({
    type: 'blob',
    mimeType: PROJECT_FILE_MIME,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

function isFiniteNumber(value: unknown, minimum = -Infinity): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum
}

function isColorStops(value: unknown): boolean {
  return Array.isArray(value)
    && value.length >= 2
    && value.every((stop) => isRecord(stop)
      && isFiniteNumber(stop.offset, 0) && stop.offset <= 1
      && typeof stop.color === 'string')
}

function isGradient(value: unknown): boolean {
  if (!isRecord(value) || !['linear', 'radial'].includes(String(value.type))) return false
  if (!isColorStops(value.stops)) return false
  if (value.angle !== undefined && !isFiniteNumber(value.angle)) return false
  if (value.centerX !== undefined && !isFiniteNumber(value.centerX)) return false
  if (value.centerY !== undefined && !isFiniteNumber(value.centerY)) return false
  return true
}

function isBackground(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.type === 'solid') return typeof value.color === 'string'
  if (value.type === 'linear-gradient') {
    return isFiniteNumber(value.angle) && isColorStops(value.stops)
  }
  if (value.type !== 'radial-gradient' || !isColorStops(value.stops)) return false
  if (value.centerX !== undefined && !isFiniteNumber(value.centerX)) return false
  if (value.centerY !== undefined && !isFiniteNumber(value.centerY)) return false
  return true
}

function isShadow(value: unknown): boolean {
  return isRecord(value)
    && isFiniteNumber(value.offsetX)
    && isFiniteNumber(value.offsetY)
    && isFiniteNumber(value.blur, 0)
    && typeof value.color === 'string'
}

function isBaseLayer(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string' && Boolean(value.id)
    && typeof value.name === 'string'
    && isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.width, 0) && value.width > 0
    && isFiniteNumber(value.height, 0) && value.height > 0
    && isFiniteNumber(value.rotation)
    && isFiniteNumber(value.opacity, 0) && value.opacity <= 1
    && typeof value.locked === 'boolean'
    && typeof value.visible === 'boolean'
    && Number.isSafeInteger(value.zIndex)
    && (value.scope === undefined || value.scope === 'layout')
    && !('src' in value) && !('screenshotUrl' in value)
}

function isImportedBezel(value: unknown): boolean {
  if (!isRecord(value) || !SAFE_ASSET_ID.test(String(value.assetId))) return false
  if (typeof value.fileName !== 'string' || !value.fileName) return false
  if (!isFiniteNumber(value.naturalWidth, 1) || !isFiniteNumber(value.naturalHeight, 1)) return false
  const screen = value.screen
  return isRecord(screen)
    && isFiniteNumber(screen.x, 0)
    && isFiniteNumber(screen.y, 0)
    && isFiniteNumber(screen.width, 1)
    && isFiniteNumber(screen.height, 1)
    && screen.x + screen.width <= value.naturalWidth
    && screen.y + screen.height <= value.naturalHeight
}

function isLayer(value: unknown, scope: 'screen' | 'layout'): value is Layer {
  if (!isRecord(value) || !isBaseLayer(value)) return false
  if (scope === 'layout' ? value.scope !== 'layout' : value.scope !== undefined) return false
  if (value.shadow !== undefined && !isShadow(value.shadow)) return false
  if (value.gradientFill !== undefined && !isGradient(value.gradientFill)) return false
  if (value.type === 'image') {
    return SAFE_ASSET_ID.test(String(value.assetId))
      && isFiniteNumber(value.originalWidth, 1)
      && isFiniteNumber(value.originalHeight, 1)
  }
  if (value.type === 'device-frame') {
    if (typeof value.deviceModel !== 'string' || !value.deviceModel) return false
    if (typeof value.deviceColor !== 'string' || !value.deviceColor) return false
    if (!['portrait', 'landscape'].includes(String(value.orientation))) return false
    if (value.screenshotAssetId !== undefined
      && !SAFE_ASSET_ID.test(String(value.screenshotAssetId))) return false
    if (value.importedBezel !== undefined && !isImportedBezel(value.importedBezel)) return false
    if (value.shadowEnabled !== undefined && typeof value.shadowEnabled !== 'boolean') return false
    if (value.shadowBlur !== undefined && !isFiniteNumber(value.shadowBlur, 0)) return false
    if (value.shadowColor !== undefined && typeof value.shadowColor !== 'string') return false
    if (value.shadowOffsetX !== undefined && !isFiniteNumber(value.shadowOffsetX)) return false
    if (value.shadowOffsetY !== undefined && !isFiniteNumber(value.shadowOffsetY)) return false
    return true
  }
  if (value.type === 'text') {
    return typeof value.content === 'string'
      && typeof value.fontFamily === 'string' && Boolean(value.fontFamily)
      && isFiniteNumber(value.fontSize, 1)
      && isFiniteNumber(value.fontWeight, 1)
      && typeof value.color === 'string'
      && ['left', 'center', 'right'].includes(String(value.textAlign))
      && isFiniteNumber(value.lineHeight, 0) && value.lineHeight > 0
      && isFiniteNumber(value.letterSpacing)
      && ['none', 'uppercase', 'lowercase', 'capitalize'].includes(String(value.textTransform))
  }
  if (value.type !== 'shape') return false
  if (!['rectangle', 'circle', 'rounded-rect'].includes(String(value.shapeType))) return false
  if (!(typeof value.fill === 'string' || isGradient(value.fill))) return false
  if (value.stroke !== undefined && typeof value.stroke !== 'string') return false
  if (value.strokeWidth !== undefined && !isFiniteNumber(value.strokeWidth, 0)) return false
  if (value.borderRadius !== undefined && !isFiniteNumber(value.borderRadius, 0)) return false
  return true
}

function isProject(value: unknown): value is Project {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return false
  if (typeof value.name !== 'string' || typeof value.activeScreenId !== 'string') return false
  if (!Array.isArray(value.screens) || !Array.isArray(value.layoutLayers)) return false
  if (!isRecord(value.globals) || !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt)) return false
  if (value.screens.length < 1 || value.screens.length > MAX_PROJECT_SCREENS) return false
  const globals = value.globals
  if (
    typeof globals.fontFamily !== 'string' || !globals.fontFamily
    || !isFiniteNumber(globals.fontWeight, 1)
    || !isFiniteNumber(globals.fontSize, 1)
    || typeof globals.fontColor !== 'string'
    || !isBackground(globals.background)
    || typeof globals.deviceModel !== 'string' || !globals.deviceModel
    || typeof globals.deviceColor !== 'string' || !globals.deviceColor
  ) return false
  const screenIds = new Set<string>()
  const layerIds = new Set<string>()
  for (const screen of value.screens) {
    if (!isRecord(screen) || typeof screen.id !== 'string' || !screen.id) return false
    if (screenIds.has(screen.id) || typeof screen.name !== 'string') return false
    if (!Array.isArray(screen.layers) || !isBackground(screen.background) || 'thumbnail' in screen) return false
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

function parseDescriptor(value: unknown): ProjectAssetDescriptor {
  if (!isRecord(value)) throw new ProjectFileError('invalid-manifest')
  const { id, path, mimeType, byteLength, sha256: digest } = value
  if (
    typeof id !== 'string' || !SAFE_ASSET_ID.test(id)
    || !isAssetMimeType(mimeType)
    || typeof path !== 'string' || path !== assetPath(id, mimeType)
    || !Number.isSafeInteger(byteLength) || Number(byteLength) <= 0
    || typeof digest !== 'string' || !SHA256.test(digest)
  ) throw new ProjectFileError('invalid-manifest')
  if (Number(byteLength) > MAX_PROJECT_ASSET_BYTES) throw new ProjectFileError('asset-too-large')
  return { id, path, mimeType, byteLength: Number(byteLength), sha256: digest }
}

function parseManifest(value: unknown): ProjectFileManifest {
  if (!isRecord(value) || value.format !== PROJECT_FILE_FORMAT) {
    throw new ProjectFileError('invalid-manifest')
  }
  if (value.version !== PROJECT_FILE_VERSION) throw new ProjectFileError('unsupported-version')
  if (!isProject(value.project) || !Array.isArray(value.assets)) {
    throw new ProjectFileError('invalid-manifest')
  }
  const assets = value.assets.map(parseDescriptor)
  const ids = new Set(assets.map((asset) => asset.id))
  const paths = new Set(assets.map((asset) => asset.path))
  if (ids.size !== assets.length || paths.size !== assets.length) {
    throw new ProjectFileError('invalid-manifest')
  }
  const totalBytes = assets.reduce((total, asset) => total + asset.byteLength, 0)
  if (totalBytes > MAX_PROJECT_TOTAL_ASSET_BYTES) throw new ProjectFileError('asset-too-large')
  const referenced = collectProjectAssetIds(value.project)
  if (
    referenced.length !== assets.length
    || referenced.some((id) => !ids.has(id))
  ) throw new ProjectFileError('missing-asset')
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    project: value.project,
    assets,
  }
}

function originalEntryName(entry: JSZipObject): string {
  return entry.unsafeOriginalName ?? entry.name
}

function uncompressedSize(entry: JSZipObject): number {
  const size = (entry as JSZipObject & { _data?: { uncompressedSize?: unknown } })
    ._data?.uncompressedSize
  if (!Number.isSafeInteger(size) || Number(size) < 0) {
    throw new ProjectFileError('invalid-archive')
  }
  return Number(size)
}

function preflightEntries(entries: JSZipObject[]): void {
  if (entries.length < 1 || entries.length > MAX_PROJECT_FILE_ENTRIES) {
    throw new ProjectFileError('invalid-archive')
  }
  if (entries.some((entry) => entry.dir || originalEntryName(entry) !== entry.name)) {
    throw new ProjectFileError('unsafe-entry')
  }
  let totalAssetBytes = 0
  for (const entry of entries) {
    const size = uncompressedSize(entry)
    if (entry.name === MANIFEST_PATH) {
      if (size > MAX_MANIFEST_BYTES) throw new ProjectFileError('invalid-manifest')
      continue
    }
    if (!SAFE_ASSET_PATH.test(entry.name)) throw new ProjectFileError('unsafe-entry')
    if (size > MAX_PROJECT_ASSET_BYTES) throw new ProjectFileError('asset-too-large')
    totalAssetBytes += size
  }
  if (totalAssetBytes > MAX_PROJECT_TOTAL_ASSET_BYTES) {
    throw new ProjectFileError('asset-too-large')
  }
}

async function loadZip(file: File): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(file, { createFolders: false })
  } catch {
    throw new ProjectFileError('invalid-archive')
  }
}

export async function readProjectFile(file: File): Promise<DecodedProjectFile> {
  if (file.size === 0) throw new ProjectFileError('invalid-archive')
  if (file.size > MAX_PROJECT_FILE_BYTES) throw new ProjectFileError('file-too-large')
  const zip = await loadZip(file)
  const entries = Object.values(zip.files)
  preflightEntries(entries)
  const manifestEntry = zip.file(MANIFEST_PATH)
  if (!manifestEntry) throw new ProjectFileError('invalid-manifest')
  let rawManifest: unknown
  try {
    const manifestJson = await manifestEntry.async('string')
    if (new TextEncoder().encode(manifestJson).byteLength > MAX_MANIFEST_BYTES) {
      throw new ProjectFileError('invalid-manifest')
    }
    rawManifest = JSON.parse(manifestJson)
  } catch (error) {
    if (error instanceof ProjectFileError) throw error
    throw new ProjectFileError('invalid-manifest')
  }
  const manifest = parseManifest(rawManifest)
  if (manifest.assets.some((asset) => !zip.file(asset.path))) {
    throw new ProjectFileError('missing-asset')
  }
  const expectedPaths = new Set([MANIFEST_PATH, ...manifest.assets.map((asset) => asset.path)])
  if (entries.some((entry) => !expectedPaths.has(entry.name)) || entries.length !== expectedPaths.size) {
    throw new ProjectFileError('unsafe-entry')
  }

  const assets = await Promise.all(manifest.assets.map(async (descriptor) => {
    const entry = zip.file(descriptor.path)
    if (!entry) throw new ProjectFileError('missing-asset')
    let bytes: Uint8Array
    try {
      bytes = await entry.async('uint8array')
    } catch {
      throw new ProjectFileError('corrupt-asset')
    }
    if (bytes.byteLength > MAX_PROJECT_ASSET_BYTES) throw new ProjectFileError('asset-too-large')
    if (bytes.byteLength !== descriptor.byteLength || await sha256(bytes) !== descriptor.sha256) {
      throw new ProjectFileError('corrupt-asset')
    }
    return {
      id: descriptor.id,
      dataUrl: await blobAsDataUrl(new Blob([Uint8Array.from(bytes)], { type: descriptor.mimeType })),
    }
  }))
  return { project: structuredClone(manifest.project), assets }
}
