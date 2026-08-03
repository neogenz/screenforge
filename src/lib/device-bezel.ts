import { readAsDataUrl } from '@/lib/image'
import type { ImportedDeviceBezel } from '@/types'

export const MAX_DEVICE_BEZEL_FILE_BYTES = 32 * 1024 * 1024
export const MAX_DEVICE_BEZEL_PIXELS = 40_000_000

const TRANSPARENT_ALPHA_MAX = 16
const MIN_SCREEN_AREA_RATIO = 0.1

export type DeviceBezelErrorCode =
  | 'invalid-format'
  | 'file-too-large'
  | 'image-too-large'
  | 'invalid-image'
  | 'screen-not-found'

const ERROR_MESSAGES: Record<DeviceBezelErrorCode, string> = {
  'invalid-format': 'Le bezel doit être un PNG transparent.',
  'file-too-large': 'Le PNG dépasse la taille maximale de 32 Mio.',
  'image-too-large': 'Le PNG dépasse la limite de 40 mégapixels.',
  'invalid-image': 'Le PNG est illisible ou endommagé.',
  'screen-not-found': "L’ouverture transparente de l’écran est introuvable.",
}

export class DeviceBezelError extends Error {
  constructor(public readonly code: DeviceBezelErrorCode) {
    super(ERROR_MESSAGES[code])
    this.name = 'DeviceBezelError'
  }
}

export interface DeviceBezelAnalysis {
  dataUrl: string
  metadata: Omit<ImportedDeviceBezel, 'assetId'>
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new DeviceBezelError('invalid-image'))
    image.src = src
  })
}

function findScreen(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): ImportedDeviceBezel['screen'] {
  const startX = Math.floor(width / 2)
  const startY = Math.floor(height / 2)
  const start = startY * width + startX
  const isTransparent = (index: number) => pixels[index * 4 + 3] <= TRANSPARENT_ALPHA_MAX
  if (!isTransparent(start)) throw new DeviceBezelError('screen-not-found')

  const visited = new Uint8Array(width * height)
  const stack = [start]
  visited[start] = 1
  let minX = startX
  let maxX = startX
  let minY = startY
  let maxY = startY
  let count = 0

  while (stack.length > 0) {
    const index = stack.pop()!
    const x = index % width
    const y = Math.floor(index / width)
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      throw new DeviceBezelError('screen-not-found')
    }

    count += 1
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)

    const neighbors = [index - 1, index + 1, index - width, index + width]
    for (const neighbor of neighbors) {
      if (!visited[neighbor] && isTransparent(neighbor)) {
        visited[neighbor] = 1
        stack.push(neighbor)
      }
    }
  }

  if (count < width * height * MIN_SCREEN_AREA_RATIO) {
    throw new DeviceBezelError('screen-not-found')
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

export async function analyzeDeviceBezel(file: File): Promise<DeviceBezelAnalysis> {
  if (file.type !== 'image/png') throw new DeviceBezelError('invalid-format')
  if (file.size > MAX_DEVICE_BEZEL_FILE_BYTES) throw new DeviceBezelError('file-too-large')

  let dataUrl: string
  let image: HTMLImageElement
  try {
    dataUrl = await readAsDataUrl(file)
    image = await decodeImage(dataUrl)
  } catch (error) {
    if (error instanceof DeviceBezelError) throw error
    throw new DeviceBezelError('invalid-image')
  }

  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  if (!naturalWidth || !naturalHeight) throw new DeviceBezelError('invalid-image')
  if (naturalWidth * naturalHeight > MAX_DEVICE_BEZEL_PIXELS) {
    throw new DeviceBezelError('image-too-large')
  }

  const canvas = document.createElement('canvas')
  canvas.width = naturalWidth
  canvas.height = naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new DeviceBezelError('invalid-image')
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, naturalWidth, naturalHeight).data
  const screen = findScreen(pixels, naturalWidth, naturalHeight)

  return {
    dataUrl,
    metadata: {
      fileName: file.name,
      naturalWidth,
      naturalHeight,
      screen,
    },
  }
}
