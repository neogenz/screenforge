import { randomBytes } from 'node:crypto'
import { open } from 'node:fs/promises'
import { extname, isAbsolute, resolve } from 'node:path'
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

/** Coffre de session : octets validés une fois, immuables jusqu'à révocation. */
export class AssetVault {
  readonly #offered = new Map<string, StoredAsset>()
  #bytes = 0

  async offer(path: string): Promise<OfferedAsset> {
    if (!isAbsolute(path)) {
      throw new AssetRefusedError(
        `Chemin relatif : « ${path} ». Donnez le chemin absolu du fichier.`,
      )
    }
    const full = resolve(path)
    const mediaType = MEDIA_TYPES[extname(full).toLowerCase()]
    if (!mediaType) {
      throw new AssetRefusedError(
        `Format non pris en charge : « ${extname(full) || full} ». Attendu : ${Object.keys(MEDIA_TYPES).join(', ')}.`,
      )
    }
    if (this.#offered.size >= MAX_VAULT_ASSETS) {
      throw new AssetRefusedError(`Coffre plein : ${MAX_VAULT_ASSETS} fichiers au plus.`)
    }

    const handle = await open(full, 'r').catch(() => null)
    if (!handle) throw new AssetRefusedError(`Fichier introuvable : « ${full} ».`)
    let bytes: Buffer
    try {
      const info = await handle.stat()
      if (!info.isFile()) throw new AssetRefusedError(`Fichier introuvable : « ${full} ».`)
      if (info.size > MAX_ASSET_BYTES) throw tooLarge(info.size)
      const target = Buffer.alloc(Math.min(info.size, MAX_ASSET_BYTES) + 1)
      let offset = 0
      while (offset < target.length) {
        const { bytesRead } = await handle.read(target, offset, target.length - offset, offset)
        if (bytesRead === 0) break
        offset += bytesRead
      }
      if (offset > MAX_ASSET_BYTES || offset === target.length) throw tooLarge(offset)
      bytes = Buffer.from(target.subarray(0, offset))
    } finally {
      await handle.close()
    }

    const inspected = inspectMedia(bytes, mediaType)
    if (!inspected) {
      throw new AssetRefusedError(`Média invalide ou actif dans « ${full} ».`)
    }
    if (this.#bytes + bytes.length > MAX_VAULT_BYTES) {
      throw new AssetRefusedError('Coffre plein : 64 Mo au total.')
    }

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
    this.#offered.clear()
    this.#bytes = 0
  }
}

function tooLarge(bytes: number): AssetRefusedError {
  return new AssetRefusedError(
    `Fichier trop lourd : ${(bytes / 1024 / 1024).toFixed(1)} Mo, 16 Mo au plus.`,
  )
}
