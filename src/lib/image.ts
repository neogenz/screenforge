/** Bounded image decoding shared by every user-facing import flow. */

export const MAX_IMAGE_FILE_BYTES = 16 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 16_000_000

export const CONTENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const
export const SCREENSHOT_IMAGE_TYPES = ['image/png', 'image/jpeg'] as const
export const IMAGE_ACCEPT = CONTENT_IMAGE_TYPES.join(',')
export const SCREENSHOT_IMAGE_ACCEPT = SCREENSHOT_IMAGE_TYPES.join(',')

export type ImageImportErrorCode =
  | 'invalid-format'
  | 'file-too-large'
  | 'image-too-large'
  | 'invalid-image'

const ERROR_MESSAGES: Record<ImageImportErrorCode, string> = {
  'invalid-format': 'Format d’image non pris en charge.',
  'file-too-large': 'L’image dépasse la taille maximale de 16 Mio.',
  'image-too-large': 'L’image dépasse la limite de 16 mégapixels.',
  'invalid-image': 'L’image est illisible ou endommagée.',
}

export class ImageImportError extends Error {
  constructor(public readonly code: ImageImportErrorCode) {
    super(ERROR_MESSAGES[code])
    this.name = 'ImageImportError'
  }
}

export interface ImportedImage {
  dataUrl: string
  width: number
  height: number
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new ImageImportError('invalid-image'))
    reader.onerror = () => reject(new ImageImportError('invalid-image'))
    reader.readAsDataURL(file)
  })
}

function decodeImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new ImageImportError('invalid-image'))
    image.src = src
  })
}

export async function importImageFile(
  file: File,
  acceptedTypes: readonly string[] = CONTENT_IMAGE_TYPES,
): Promise<ImportedImage> {
  if (!acceptedTypes.includes(file.type)) throw new ImageImportError('invalid-format')
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new ImageImportError('file-too-large')

  try {
    const dataUrl = await readAsDataUrl(file)
    const { width, height } = await decodeImage(dataUrl)
    if (!width || !height) throw new ImageImportError('invalid-image')
    if (width > Math.floor(MAX_IMAGE_PIXELS / height)) {
      throw new ImageImportError('image-too-large')
    }
    return { dataUrl, width, height }
  } catch (error) {
    if (error instanceof ImageImportError) throw error
    throw new ImageImportError('invalid-image')
  }
}

export function imageImportErrorMessage(error: unknown): string {
  return error instanceof ImageImportError ? error.message : ERROR_MESSAGES['invalid-image']
}
