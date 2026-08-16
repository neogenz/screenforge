import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ImageImportError,
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_PIXELS,
  SCREENSHOT_IMAGE_TYPES,
  importImageFile,
} from '@/lib/image'

let reads = 0
let dimensions = { width: 100, height: 200 }
let decodeFails = false

class MockFileReader {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  readAsDataURL() {
    reads += 1
    this.result = 'data:image/png;base64,aW1hZ2U='
    queueMicrotask(() => this.onload?.())
  }
}

class MockImage {
  naturalWidth = dimensions.width
  naturalHeight = dimensions.height
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(_value: string) {
    queueMicrotask(() => (decodeFails ? this.onerror?.() : this.onload?.()))
  }
}

function file(type = 'image/png', size = 100): File {
  return { name: 'image', type, size } as File
}

describe('image import', () => {
  beforeEach(() => {
    reads = 0
    dimensions = { width: 100, height: 200 }
    decodeFails = false
    vi.stubGlobal('FileReader', MockFileReader)
    vi.stubGlobal('Image', MockImage)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('rejects unsupported and oversized files before reading bytes', async () => {
    await expect(importImageFile(file('application/pdf'))).rejects.toMatchObject({
      code: 'invalid-format',
    })
    await expect(
      importImageFile(file('image/png', MAX_IMAGE_FILE_BYTES + 1)),
    ).rejects.toMatchObject({ code: 'file-too-large' })
    expect(reads).toBe(0)
  })

  it('allows SVG content but not SVG device screenshots', async () => {
    await expect(importImageFile(file('image/svg+xml'))).resolves.toMatchObject(dimensions)
    await expect(
      importImageFile(file('image/svg+xml'), SCREENSHOT_IMAGE_TYPES),
    ).rejects.toMatchObject({ code: 'invalid-format' })
  })

  it('rejects decoded images above 16 megapixels', async () => {
    dimensions = { width: MAX_IMAGE_PIXELS + 1, height: 1 }
    await expect(importImageFile(file())).rejects.toMatchObject({ code: 'image-too-large' })
  })

  it('returns one stable error for invalid decoded content', async () => {
    decodeFails = true
    await expect(importImageFile(file())).rejects.toEqual(new ImageImportError('invalid-image'))
  })
})
