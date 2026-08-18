import { SaxesParser } from 'saxes'

export const MAX_MEDIA_PIXELS = 16_000_000

export type InspectedMedia = {
  type: 'image/png' | 'image/jpeg' | 'image/svg+xml'
  width: number
  height: number
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const SVG_TAGS = new Set([
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'pattern',
  'use',
  'title',
  'desc',
])

function dimensions(
  type: InspectedMedia['type'],
  width: number,
  height: number,
): InspectedMedia | null {
  return Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width * height <= MAX_MEDIA_PIXELS
    ? { type, width, height }
    : null
}

function png(bytes: Uint8Array): InspectedMedia | null {
  if (bytes.length < 45 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  let size: InspectedMedia | null = null
  let imageData = false
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const end = offset + 12 + length
    if (end > bytes.length) return null
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (offset === 8) {
      if (type !== 'IHDR' || length !== 13) return null
      size = dimensions('image/png', view.getUint32(offset + 8), view.getUint32(offset + 12))
      if (!size) return null
    } else if (type === 'IHDR') {
      return null
    } else if (type === 'IDAT') {
      imageData ||= length > 0
    } else if (type === 'IEND') {
      return length === 0 && imageData && end === bytes.length ? size : null
    }
    offset = end
  }
  return null
}

function jpeg(bytes: Uint8Array): InspectedMedia | null {
  if (
    bytes.length < 13 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    return null
  }
  let offset = 2
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) return null
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset++]
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return null
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) return null
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!
    if (length < 2 || offset + length > bytes.length) return null
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (length < 7) return null
      return dimensions(
        'image/jpeg',
        (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
        (bytes[offset + 3]! << 8) | bytes[offset + 4]!,
      )
    }
    offset += length
  }
  return null
}

function svgNumber(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d+)?(?:px)?$/i.test(value.trim())) return null
  const parsed = Number.parseFloat(value)
  return Number.isInteger(parsed) ? parsed : null
}

function svg(bytes: Uint8Array): InspectedMedia | null {
  let source: string
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
  if (/<!doctype|<!entity/i.test(source)) return null

  let invalid = false
  let rootSeen = false
  let result: InspectedMedia | null = null
  const parser = new SaxesParser({ xmlns: false })
  parser.on('doctype', () => {
    invalid = true
  })
  parser.on('processinginstruction', () => {
    invalid = true
  })
  parser.on('error', () => {
    invalid = true
  })
  parser.on('opentag', (tag) => {
    const name = tag.name.toLowerCase()
    if (!rootSeen) {
      rootSeen = true
      if (name !== 'svg' || tag.name.includes(':')) invalid = true
      const width = svgNumber(tag.attributes.width)
      const height = svgNumber(tag.attributes.height)
      const viewBox = tag.attributes.viewBox
        ?.trim()
        .split(/[\s,]+/)
        .map(Number)
      result =
        width !== null && height !== null
          ? dimensions('image/svg+xml', width, height)
          : viewBox?.length === 4 && viewBox.every(Number.isFinite)
            ? dimensions('image/svg+xml', viewBox[2]!, viewBox[3]!)
            : null
      if (!result) invalid = true
    }
    if (!SVG_TAGS.has(name) || name === 'script' || name === 'foreignobject') invalid = true
    for (const [rawName, value] of Object.entries(tag.attributes)) {
      const attribute = rawName.toLowerCase()
      const normalized = value.trim().toLowerCase()
      if (attribute.startsWith('on') || /javascript:|@import|expression\s*\(/i.test(value)) {
        invalid = true
      }
      if ((attribute === 'href' || attribute === 'xlink:href') && !value.trim().startsWith('#')) {
        invalid = true
      }
      for (const match of normalized.matchAll(/url\(([^)]*)\)/g)) {
        const reference = match[1]!.trim().replace(/^['"]|['"]$/g, '')
        if (!reference.startsWith('#')) invalid = true
      }
    }
  })
  try {
    parser.write(source).close()
  } catch {
    return null
  }
  return rootSeen && !invalid ? result : null
}

/** Inspecte les octets sans les modifier et exige la concordance du type déclaré. */
export function inspectMedia(bytes: Uint8Array, declaredType: string): InspectedMedia | null {
  const inspected =
    png(bytes) ?? jpeg(bytes) ?? (declaredType === 'image/svg+xml' ? svg(bytes) : null)
  return inspected?.type === declaredType ? inspected : null
}
