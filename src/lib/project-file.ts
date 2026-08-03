import JSZip, { type JSZipObject } from 'jszip'
import { resolveAsset } from '@/lib/assets'
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

function isProject(value: unknown): value is Project {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return false
  if (typeof value.activeScreenId !== 'string' || !Array.isArray(value.screens)) return false
  if (!Array.isArray(value.layoutLayers) || !isRecord(value.globals)) return false
  if (!Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt)) return false
  if (value.screens.length < 1 || value.screens.length > 10) return false
  return value.screens.every((screen) => isRecord(screen)
    && typeof screen.id === 'string'
    && typeof screen.name === 'string'
    && Array.isArray(screen.layers)
    && isRecord(screen.background)
    && !('thumbnail' in screen))
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
  return (entry as JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name
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
  const files = entries.filter((entry) => !entry.dir)
  if (files.length < 1 || files.length > MAX_PROJECT_FILE_ENTRIES) {
    throw new ProjectFileError('invalid-archive')
  }
  if (entries.some((entry) => originalEntryName(entry) !== entry.name)) {
    throw new ProjectFileError('unsafe-entry')
  }
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
  if (files.some((entry) => !expectedPaths.has(entry.name)) || files.length !== expectedPaths.size) {
    throw new ProjectFileError('unsafe-entry')
  }

  const assets = await Promise.all(manifest.assets.map(async (descriptor) => {
    const entry = zip.file(descriptor.path)
    if (!entry) throw new ProjectFileError('missing-asset')
    const bytes = await entry.async('uint8array')
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
