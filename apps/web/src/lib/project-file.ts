import type JSZip from 'jszip'
import type { JSZipObject } from 'jszip'
import { resolveAsset } from '@/lib/assets'
import { collectAssetIds } from '@/lib/asset-refs'
import { sha256Hex } from '@/lib/hash'
import { isProject, migrateProject } from '@/lib/project-validation'
import type { Project } from '@/types'

export const PROJECT_FILE_EXTENSION = '.screenforge.zip'
export const PROJECT_FILE_MIME = 'application/zip'
export const MAX_PROJECT_FILE_BYTES = 256 * 1024 * 1024
export const MAX_PROJECT_ASSET_BYTES = 64 * 1024 * 1024
export const MAX_PROJECT_TOTAL_ASSET_BYTES = 256 * 1024 * 1024
export const MAX_PROJECT_FILE_ENTRIES = 128

const PROJECT_FILE_FORMAT = 'screenforge-project'

/**
 * La version écrite aujourd'hui, et la plus ancienne encore lue.
 *
 * Le test d'égalité qui vivait ici refusait toute archive dont le numéro
 * n'était pas exactement celui du binaire courant : la première version qui
 * aurait ajouté un discriminant au modèle aurait rendu illisibles toutes les
 * archives déjà exportées par les utilisateurs, sans que rien dans leur contenu
 * ne l'exige. Une archive plus ancienne est lisible tant que `migrateProject`
 * sait la porter — c'est là que la compatibilité se décide, pas ici.
 *
 * Vers l'avant, en revanche, le refus reste net et c'est le point : une archive
 * plus récente contient des champs que ce binaire ne sait pas interpréter, et
 * l'ouvrir en ignorant ce qu'il n'a pas compris rendrait à l'utilisateur un
 * projet silencieusement amputé. Mieux vaut une erreur nommée.
 *
 * `PROJECT_FILE_VERSION` ne monte donc qu'avec un vrai changement de forme, et
 * dans le même commit que la migration qui le rattrape.
 */
const PROJECT_FILE_VERSION = 5
const MIN_READABLE_PROJECT_FILE_VERSION = 1

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

export function collectProjectAssetIds(project: Project): string[] {
  return [...collectAssetIds(project)].sort()
}

/**
 * L'aperçu d'un écran est un cache de rendu, pas une donnée du projet.
 *
 * Il se régénère seul au premier rendu du canevas, il pèse quelques kilooctets
 * de PNG en base64 par écran, et il change à chaque coup de pinceau. Tout ce qui
 * sort de ce navigateur le laisse donc derrière : le fichier portable, comme la
 * ligne poussée dans le cloud — sans quoi `projects.data` porterait des data URL
 * et chaque sauvegarde renverrait dix vignettes que personne n'a demandées.
 */
export function projectWithoutThumbnails(project: Project): Project {
  const copy = structuredClone(project)
  for (const screen of copy.screens) delete screen.thumbnail
  for (const release of copy.releases ?? []) {
    for (const screen of release.snapshot.screens) delete screen.thumbnail
  }
  return copy
}

async function dataUrlBytes(
  dataUrl: string,
): Promise<{ mimeType: AssetMimeType; bytes: Uint8Array }> {
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
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new ProjectFileError('corrupt-asset'))
    reader.onerror = () => reject(new ProjectFileError('corrupt-asset'))
    reader.readAsDataURL(blob)
  })
}

export async function createProjectFile(project: Project): Promise<Blob> {
  const ids = collectProjectAssetIds(project)
  if (ids.length > MAX_PROJECT_FILE_ENTRIES - 1) throw new ProjectFileError('invalid-manifest')
  const assets = await Promise.all(
    ids.map(async (id) => {
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
          sha256: await sha256Hex(bytes),
        } satisfies ProjectAssetDescriptor,
        bytes,
      }
    }),
  )
  const totalBytes = assets.reduce((total, asset) => total + asset.bytes.byteLength, 0)
  if (totalBytes > MAX_PROJECT_TOTAL_ASSET_BYTES) throw new ProjectFileError('asset-too-large')

  const serializedProject = projectWithoutThumbnails(project)
  if (!isProject(serializedProject)) throw new ProjectFileError('invalid-manifest')
  const manifest: ProjectFileManifest = {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    project: serializedProject,
    assets: assets.map(({ descriptor }) => descriptor),
  }
  const manifestJson = JSON.stringify(manifest, null, 2)
  if (new TextEncoder().encode(manifestJson).byteLength > MAX_MANIFEST_BYTES) {
    throw new ProjectFileError('invalid-manifest')
  }

  const { default: JSZip } = await import('jszip')
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

function parseDescriptor(value: unknown): ProjectAssetDescriptor {
  if (!isRecord(value)) throw new ProjectFileError('invalid-manifest')
  const { id, path, mimeType, byteLength, sha256: digest } = value
  if (
    typeof id !== 'string' ||
    !SAFE_ASSET_ID.test(id) ||
    !isAssetMimeType(mimeType) ||
    typeof path !== 'string' ||
    path !== assetPath(id, mimeType) ||
    !Number.isSafeInteger(byteLength) ||
    Number(byteLength) <= 0 ||
    typeof digest !== 'string' ||
    !SHA256.test(digest)
  )
    throw new ProjectFileError('invalid-manifest')
  if (Number(byteLength) > MAX_PROJECT_ASSET_BYTES) throw new ProjectFileError('asset-too-large')
  return { id, path, mimeType, byteLength: Number(byteLength), sha256: digest }
}

function parseManifest(value: unknown): ProjectFileManifest {
  if (!isRecord(value) || value.format !== PROJECT_FILE_FORMAT) {
    throw new ProjectFileError('invalid-manifest')
  }
  if (
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < MIN_READABLE_PROJECT_FILE_VERSION ||
    Number(value.version) > PROJECT_FILE_VERSION
  ) {
    throw new ProjectFileError('unsupported-version')
  }
  const project = migrateProject(value.project)
  if (!isProject(project) || !Array.isArray(value.assets)) {
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
  const referenced = collectProjectAssetIds(project)
  if (referenced.length !== assets.length || referenced.some((id) => !ids.has(id)))
    throw new ProjectFileError('missing-asset')
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    project,
    assets,
  }
}

function originalEntryName(entry: JSZipObject): string {
  return entry.unsafeOriginalName ?? entry.name
}

function uncompressedSize(entry: JSZipObject): number {
  const size = (entry as JSZipObject & { _data?: { uncompressedSize?: unknown } })._data
    ?.uncompressedSize
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
    const { default: JSZip } = await import('jszip')
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
  if (
    entries.some((entry) => !expectedPaths.has(entry.name)) ||
    entries.length !== expectedPaths.size
  ) {
    throw new ProjectFileError('unsafe-entry')
  }

  const assets = await Promise.all(
    manifest.assets.map(async (descriptor) => {
      const entry = zip.file(descriptor.path)
      if (!entry) throw new ProjectFileError('missing-asset')
      let bytes: Uint8Array
      try {
        bytes = await entry.async('uint8array')
      } catch {
        throw new ProjectFileError('corrupt-asset')
      }
      if (bytes.byteLength > MAX_PROJECT_ASSET_BYTES) throw new ProjectFileError('asset-too-large')
      if (
        bytes.byteLength !== descriptor.byteLength ||
        (await sha256Hex(bytes)) !== descriptor.sha256
      ) {
        throw new ProjectFileError('corrupt-asset')
      }
      return {
        id: descriptor.id,
        dataUrl: await blobAsDataUrl(
          new Blob([Uint8Array.from(bytes)], { type: descriptor.mimeType }),
        ),
      }
    }),
  )
  return { project: structuredClone(manifest.project), assets }
}
