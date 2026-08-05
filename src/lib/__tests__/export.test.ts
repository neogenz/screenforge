import { describe, expect, it } from 'vitest'
import {
  INTERNAL_PNG_SIZE_TARGET,
  assertAppStorePng,
  inspectPng,
  type PngMetadata,
} from '@/lib/export'

function pngHeader(width = 1320, height = 2868, bitDepth = 8, colorType = 2): Blob {
  const bytes = new Uint8Array(33)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([73, 72, 68, 82], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  bytes[24] = bitDepth
  bytes[25] = colorType
  return new Blob([bytes], { type: 'image/png' })
}

describe('inspectPng', () => {
  it('reads a minimal valid IHDR header', async () => {
    await expect(inspectPng(pngHeader())).resolves.toEqual({
      width: 1320,
      height: 2868,
      bitDepth: 8,
      colorType: 2,
      byteLength: 33,
    })
  })

  it('rejects an invalid PNG signature or IHDR', async () => {
    await expect(inspectPng(new Blob([new Uint8Array(33)]))).rejects.toThrow(
      'Signature PNG invalide',
    )
    const header = pngHeader()
    const bytes = new Uint8Array(await header.arrayBuffer())
    bytes[12] = 0
    await expect(inspectPng(new Blob([bytes]))).rejects.toThrow('En-tête PNG invalide')
  })
})

describe('assertAppStorePng', () => {
  const valid: PngMetadata = {
    width: 1320,
    height: 2868,
    bitDepth: 8,
    colorType: 2,
    byteLength: 33,
  }

  it('accepts the exact opaque PNG contract', () => {
    expect(() => assertAppStorePng(valid, 1320, 2868)).not.toThrow()
  })

  it.each([
    [{ ...valid, width: 1179 }, 'Dimensions invalides'],
    [{ ...valid, bitDepth: 16 }, 'Profondeur PNG invalide'],
    [{ ...valid, colorType: 6 }, 'Canal alpha détecté'],
    [{ ...valid, byteLength: INTERNAL_PNG_SIZE_TARGET + 1 }, 'PNG trop lourd'],
  ] as const)('rejects an invalid contract', (metadata, message) => {
    expect(() => assertAppStorePng(metadata, 1320, 2868)).toThrow(message)
  })
})
