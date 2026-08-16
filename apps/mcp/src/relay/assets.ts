import { randomBytes } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, resolve } from 'node:path'

/**
 * Les fichiers que l'agent a nommés, et rien d'autre sur ce disque.
 *
 * Le démon tourne avec les droits de l'utilisateur : il pourrait lire n'importe
 * quoi. La route `/asset/:id` ne sert donc pas un chemin — elle sert un
 * identifiant qu'un appel d'outil a fait entrer ici, et un identifiant que
 * personne n'a offert n'existe pas. Une route qui aurait pris `?path=` aurait
 * fait de l'onglet un lecteur du disque entier, à un paramètre près.
 *
 * L'offre est une décision de l'agent, pas de la page : c'est l'agent qui a le
 * contexte du projet de l'utilisateur et qui sait quel fichier joindre. La page
 * ne fait que récupérer ce qui lui a été désigné.
 *
 * Le coffre vit avec le processus, comme le jeton. Rien n'est écrit, rien ne
 * survit à un redémarrage, et les chemins offerts ne sont pas rejoués : un
 * fichier déplacé entre deux sessions doit être renommé, pas résolu de mémoire.
 */

/** Ce que l'éditeur sait afficher, moins ce qu'aucun en-tête ne mesure. */
const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

/**
 * La même borne que l'import à la souris, au nom de la même contrainte : ce qui
 * entre finit en data URL dans IndexedDB, et un fichier de 100 Mo y tiendrait
 * autant de place, en base64 gonflé d'un tiers.
 */
export const MAX_ASSET_BYTES = 16 * 1024 * 1024

export class AssetRefusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetRefusedError'
  }
}

export interface OfferedAsset {
  id: string
  path: string
  mediaType: string
  width: number
  height: number
}

/**
 * Les dimensions, lues dans l'en-tête et pas devinées.
 *
 * `add_image` et `add_device` les exigent — un cadrage « cover » sans le
 * rapport de la source est impossible à calculer — et le démon doit produire un
 * appel qui passe `validateToolCall` avant de l'envoyer. Il n'a pas de
 * décodeur, mais il n'en a pas besoin : les trois formats déclarent leur taille
 * en clair, dans les premiers octets pour deux d'entre eux.
 */
function pngSize(bytes: Buffer): { width: number; height: number } | null {
  // IHDR est toujours le premier chunk : signature (8) + longueur (4) + type (4).
  if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1] ?? 0
    const length = bytes.readUInt16BE(offset + 2)
    // SOF0..SOF15, sauf les marqueurs qui ne décrivent pas une trame.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  return null
}

function svgSize(bytes: Buffer): { width: number; height: number } | null {
  const head = bytes.toString('utf8', 0, Math.min(bytes.length, 4096))
  const viewBox = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(head)
  if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) }
  const width = /\bwidth\s*=\s*["']([\d.]+)/.exec(head)
  const height = /\bheight\s*=\s*["']([\d.]+)/.exec(head)
  return width && height ? { width: Number(width[1]), height: Number(height[1]) } : null
}

const READERS: Record<string, (bytes: Buffer) => { width: number; height: number } | null> = {
  'image/png': pngSize,
  'image/jpeg': jpegSize,
  'image/svg+xml': svgSize,
}

export class AssetVault {
  readonly #offered = new Map<string, OfferedAsset>()

  /**
   * Fait entrer un fichier local et rend de quoi le poser.
   *
   * Chaque refus nomme sa cause : un agent qui reçoit « refusé » sans savoir
   * s'il s'est trompé de chemin, de format ou de fichier réessaie au hasard.
   */
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

    const info = await stat(full).catch(() => null)
    if (!info?.isFile()) throw new AssetRefusedError(`Fichier introuvable : « ${full} ».`)
    if (info.size > MAX_ASSET_BYTES) {
      const mega = (info.size / 1024 / 1024).toFixed(1)
      throw new AssetRefusedError(`Fichier trop lourd : ${mega} Mo, 16 Mo au plus.`)
    }

    const bytes = await readFile(full)
    const size = READERS[mediaType]?.(bytes) ?? null
    if (!size || !(size.width > 0) || !(size.height > 0)) {
      throw new AssetRefusedError(`Dimensions illisibles dans « ${full} ». Fichier endommagé ?`)
    }

    const asset: OfferedAsset = {
      id: randomBytes(12).toString('hex'),
      path: full,
      mediaType,
      width: Math.round(size.width),
      height: Math.round(size.height),
    }
    this.#offered.set(asset.id, asset)
    return asset
  }

  get(id: string): OfferedAsset | undefined {
    return this.#offered.get(id)
  }

  /** Relit le fichier à la demande : offrir n'était pas le copier en mémoire. */
  async read(id: string): Promise<{ bytes: Buffer; mediaType: string } | null> {
    const asset = this.#offered.get(id)
    if (!asset) return null
    const bytes = await readFile(asset.path).catch(() => null)
    return bytes ? { bytes, mediaType: asset.mediaType } : null
  }
}
