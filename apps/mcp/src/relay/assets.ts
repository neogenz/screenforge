import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { inspectMedia } from '@screenforge/project-format/media-validation'

const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

export const MAX_ASSET_BYTES = 16 * 1024 * 1024
export const MAX_VAULT_ASSETS = 64
export const MAX_VAULT_BYTES = 64 * 1024 * 1024

export class AssetRefusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetRefusedError'
  }
}

export interface OfferedAsset {
  id: string
  mediaType: string
  width: number
  height: number
}

type StoredAsset = OfferedAsset & { bytes: Buffer }
export type AssetRootProvider = () => Promise<readonly string[]>
type CanonicalRoot = { requested: string; canonical: string }

const run = promisify(execFile)
const OPEN_BENEATH = resolve(import.meta.dirname, '../../build/open-beneath')

function contains(root: string, target: string): boolean {
  const path = relative(root, target)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))
}

/** Coffre de session : octets validés une fois, immuables jusqu'à révocation. */
export class AssetVault {
  readonly #offered = new Map<string, StoredAsset>()
  #bytes = 0
  #epoch = 0
  #tail: Promise<void> = Promise.resolve()
  #roots: Promise<readonly CanonicalRoot[]> | null = null
  readonly #rootProvider: AssetRootProvider

  constructor(rootProvider: AssetRootProvider = () => Promise.resolve([])) {
    this.#rootProvider = rootProvider
  }

  async #allowedRoots(): Promise<readonly CanonicalRoot[]> {
    this.#roots ??= this.#rootProvider()
      .then(async (roots) =>
        (
          await Promise.all(
            roots.filter(isAbsolute).map(async (root) => {
              const canonical = await realpath(root).catch(() => null)
              return canonical ? { requested: resolve(root), canonical } : null
            }),
          )
        ).filter((root): root is CanonicalRoot => root !== null),
      )
      .catch(() => [])
    return this.#roots
  }

  async #authorized(path: string, noun: 'Fichier' | 'Répertoire'): Promise<string> {
    if (!isAbsolute(path)) {
      throw new AssetRefusedError(
        `Chemin relatif : « ${path} ». Donnez le chemin absolu du ${noun.toLowerCase()}.`,
      )
    }
    const requested = resolve(path)
    const roots = await this.#allowedRoots()
    if (roots.length === 0) {
      throw new AssetRefusedError(
        'Aucun répertoire d’images autorisé par le client MCP ou la configuration.',
      )
    }
    if (
      !roots.some(
        (root) => contains(root.requested, requested) || contains(root.canonical, requested),
      )
    ) {
      throw new AssetRefusedError(`${noun} hors des répertoires autorisés : « ${requested} ».`)
    }
    const canonical = await realpath(requested).catch(() => null)
    if (!canonical) throw new AssetRefusedError(`${noun} introuvable : « ${requested} ».`)
    if (!roots.some((root) => contains(root.canonical, canonical))) {
      throw new AssetRefusedError(`${noun} hors des répertoires autorisés : « ${requested} ».`)
    }
    return canonical
  }

  authorizeDirectory(path: string): Promise<string> {
    return this.#authorized(path, 'Répertoire')
  }

  offer(path: string): Promise<OfferedAsset> {
    const epoch = this.#epoch
    const operation = this.#tail.then(() => this.#offer(path, epoch))
    this.#tail = operation.then(
      () => undefined,
      () => undefined,
    )
    return operation
  }

  async #offer(path: string, epoch: number): Promise<OfferedAsset> {
    if (epoch !== this.#epoch) throw new AssetRefusedError('Le coffre a été révoqué.')
    if (!isAbsolute(path)) {
      throw new AssetRefusedError(
        `Chemin relatif : « ${path} ». Donnez le chemin absolu du fichier.`,
      )
    }
    const requested = resolve(path)
    const mediaType = MEDIA_TYPES[extname(requested).toLowerCase()]
    if (!mediaType) {
      throw new AssetRefusedError(
        `Format non pris en charge : « ${extname(requested) || requested} ». Attendu : ${Object.keys(MEDIA_TYPES).join(', ')}.`,
      )
    }
    if (this.#offered.size >= MAX_VAULT_ASSETS) {
      throw new AssetRefusedError(`Coffre plein : ${MAX_VAULT_ASSETS} fichiers au plus.`)
    }
    const roots = await this.#allowedRoots()
    if (roots.length === 0) {
      throw new AssetRefusedError(
        'Aucun répertoire d’images autorisé par le client MCP ou la configuration.',
      )
    }
    const root = roots.find(
      (candidate) =>
        contains(candidate.requested, requested) || contains(candidate.canonical, requested),
    )
    if (!root) {
      throw new AssetRefusedError(`Fichier hors des répertoires autorisés : « ${requested} ».`)
    }
    const localPath = contains(root.requested, requested)
      ? relative(root.requested, requested)
      : relative(root.canonical, requested)

    let bytes: Buffer
    try {
      const args = [root.canonical, localPath]
      if (process.env.SCREENFORGE_OPEN_BENEATH_TEST_HOOK) {
        args.push(process.env.SCREENFORGE_OPEN_BENEATH_TEST_HOOK)
      }
      const result = await run(OPEN_BENEATH, args, {
        encoding: 'buffer',
        maxBuffer: MAX_ASSET_BYTES + 1024,
      })
      bytes = Buffer.from(result.stdout)
    } catch (error) {
      const stderr =
        typeof error === 'object' && error && 'stderr' in error
          ? String((error as { stderr?: unknown }).stderr)
          : ''
      if (/too large|maxBuffer/i.test(stderr || String(error))) throw tooLarge(MAX_ASSET_BYTES + 1)
      throw new AssetRefusedError(
        `Fichier introuvable, remplacé ou hors des répertoires autorisés : « ${requested} ».`,
      )
    }

    const inspected = inspectMedia(bytes, mediaType)
    if (!inspected) {
      throw new AssetRefusedError(`Média invalide ou actif dans « ${requested} ».`)
    }
    if (this.#bytes + bytes.length > MAX_VAULT_BYTES) {
      throw new AssetRefusedError('Coffre plein : 64 Mo au total.')
    }
    if (epoch !== this.#epoch) throw new AssetRefusedError('Le coffre a été révoqué.')

    const stored: StoredAsset = {
      id: randomBytes(12).toString('hex'),
      mediaType: inspected.type,
      width: inspected.width,
      height: inspected.height,
      bytes,
    }
    this.#offered.set(stored.id, stored)
    this.#bytes += bytes.length
    return {
      id: stored.id,
      mediaType: stored.mediaType,
      width: stored.width,
      height: stored.height,
    }
  }

  get(id: string): OfferedAsset | undefined {
    const asset = this.#offered.get(id)
    return asset
      ? { id: asset.id, mediaType: asset.mediaType, width: asset.width, height: asset.height }
      : undefined
  }

  read(id: string): { bytes: Buffer; mediaType: string } | null {
    const asset = this.#offered.get(id)
    return asset ? { bytes: Buffer.from(asset.bytes), mediaType: asset.mediaType } : null
  }

  clear(): void {
    this.#epoch += 1
    this.#offered.clear()
    this.#bytes = 0
    this.#roots = null
  }
}

function tooLarge(bytes: number): AssetRefusedError {
  return new AssetRefusedError(
    `Fichier trop lourd : ${(bytes / 1024 / 1024).toFixed(1)} Mo, 16 Mo au plus.`,
  )
}
