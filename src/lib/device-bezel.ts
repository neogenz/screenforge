import type { ImportedDeviceBezel } from '@/types'

export const MAX_DEVICE_BEZEL_FILE_BYTES = 32 * 1024 * 1024
export const MAX_DEVICE_BEZEL_PIXELS = 40_000_000

const TRANSPARENT_ALPHA_MAX = 16
const QUEUED_ALPHA = TRANSPARENT_ALPHA_MAX + 1
const MIN_SCREEN_AREA_RATIO = 0.1
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const

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

function readBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(new Uint8Array(reader.result))
      : reject(new DeviceBezelError('invalid-image'))
    reader.onerror = () => reject(new DeviceBezelError('invalid-image'))
    reader.readAsArrayBuffer(file)
  })
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    throw new DeviceBezelError('invalid-image')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ihdr = String.fromCharCode(...bytes.subarray(12, 16))
  if (view.getUint32(8) !== 13 || ihdr !== 'IHDR') {
    throw new DeviceBezelError('invalid-image')
  }
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (!width || !height) throw new DeviceBezelError('invalid-image')
  if (width > Math.floor(MAX_DEVICE_BEZEL_PIXELS / height)) {
    throw new DeviceBezelError('image-too-large')
  }
  return { width, height }
}

function bytesToDataUrl(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  const chunks = new Array<string>(Math.ceil(bytes.length / chunkSize))
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks[offset / chunkSize] = String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return `data:image/png;base64,${btoa(chunks.join(''))}`
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

  const pixelCount = width * height
  let stack = new Uint32Array(Math.min(1024, pixelCount))
  let stackLength = 0
  const push = (index: number) => {
    if (stackLength === stack.length) {
      const grown = new Uint32Array(Math.min(pixelCount, stack.length * 2))
      grown.set(stack)
      stack = grown
    }
    pixels[index * 4 + 3] = QUEUED_ALPHA
    stack[stackLength] = index
    stackLength += 1
  }
  push(start)
  let minX = startX
  let maxX = startX
  let minY = startY
  let maxY = startY
  let count = 0

  while (stackLength > 0) {
    stackLength -= 1
    const index = stack[stackLength]
    const seedX = index % width
    const y = Math.floor(index / width)
    let left = seedX
    let right = seedX
    while (left > 0 && isTransparent(y * width + left - 1)) left -= 1
    while (right < width - 1 && isTransparent(y * width + right + 1)) right += 1
    if (left === 0 || right === width - 1 || y === 0 || y === height - 1) {
      throw new DeviceBezelError('screen-not-found')
    }

    count += right - left + 1
    minX = Math.min(minX, left)
    maxX = Math.max(maxX, right)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
    for (let x = left; x <= right; x += 1) pixels[(y * width + x) * 4 + 3] = 255

    for (let deltaY = -1; deltaY <= 1; deltaY += 2) {
      const neighborY = y + deltaY
      let insideRun = false
      for (let x = left; x <= right; x += 1) {
        const neighbor = neighborY * width + x
        const alpha = pixels[neighbor * 4 + 3]
        if (alpha <= TRANSPARENT_ALPHA_MAX) {
          if (!insideRun) push(neighbor)
          insideRun = true
        } else if (alpha !== QUEUED_ALPHA) {
          insideRun = false
        }
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

  let bytes: Uint8Array
  let expectedSize: { width: number; height: number }
  let dataUrl: string
  let image: HTMLImageElement
  try {
    bytes = await readBytes(file)
    expectedSize = readPngDimensions(bytes)
    dataUrl = bytesToDataUrl(bytes)
    image = await decodeImage(dataUrl)
  } catch (error) {
    if (error instanceof DeviceBezelError) throw error
    throw new DeviceBezelError('invalid-image')
  }

  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  if (naturalWidth !== expectedSize.width || naturalHeight !== expectedSize.height) {
    throw new DeviceBezelError('invalid-image')
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
