import { encode } from 'fast-png'

export const MOCK_BEZEL = {
  width: 19,
  height: 31,
  screen: { x: 4, y: 5, width: 11, height: 19 },
} as const

export const APP_STORE_BEZEL = {
  width: 1320,
  height: 2868,
  screen: { x: 80, y: 120, width: 1160, height: 2628 },
} as const

type BezelKind = 'valid' | 'opaque' | 'open' | 'alpha-17-separator'

export function makeDeviceBezelPng(
  kind: BezelKind = 'valid',
  geometry: {
    width: number
    height: number
    screen: { x: number; y: number; width: number; height: number }
  } = MOCK_BEZEL,
): Buffer {
  const { width, height, screen } = geometry
  const data = new Uint8Array(width * height * 4)

  // Transparent canvas, opaque phone body.
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const offset = (y * width + x) * 4
      data.set([24, 88, 176, 255], offset)
    }
  }

  if (kind !== 'opaque') {
    for (let y = screen.y; y < screen.y + screen.height; y += 1) {
      for (let x = screen.x; x < screen.x + screen.width; x += 1) {
        data[(y * width + x) * 4 + 3] = 0
      }
    }
  }

  if (kind === 'open') {
    const y = screen.y + Math.floor(screen.height / 2)
    for (let x = 0; x < screen.x; x += 1) data[(y * width + x) * 4 + 3] = 0
  }

  if (kind === 'alpha-17-separator') {
    for (let y = screen.y; y < screen.y + screen.height; y += 1) {
      for (let x = screen.x; x < screen.x + screen.width; x += 1) {
        data[(y * width + x) * 4 + 3] = 255
      }
    }
    for (let y = 9; y <= 23; y += 1) {
      for (let x = 5; x <= 13; x += 1) data[(y * width + x) * 4 + 3] = 0
    }
    for (let x = 4; x <= 14; x += 1) data[(8 * width + x) * 4 + 3] = 0
    data[(8 * width + 7) * 4 + 3] = 17
  }

  return Buffer.from(encode({ width, height, data, channels: 4, depth: 8 }))
}

export const corruptPng = () => Buffer.from('not a png')

export function makeSolidPng(
  width: number,
  height: number,
  color: readonly [number, number, number, number],
): Buffer {
  const data = new Uint8Array(width * height * 4)
  for (let offset = 0; offset < data.length; offset += 4) data.set(color, offset)
  return Buffer.from(encode({ width, height, data, channels: 4, depth: 8 }))
}

export function asBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}
