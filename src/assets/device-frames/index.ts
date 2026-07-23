import type { DeviceModel, DeviceColor } from '@/types'

export interface DeviceFrameConfig {
  model: DeviceModel
  modelName: string
  /** Apple screen diagonal, shown in pickers (e.g. '6.9"') */
  screenSize: string
  /** Sold by Apple today; legacy models stay renderable for old projects */
  current: boolean
  width: number
  height: number
  screenX: number
  screenY: number
  screenWidth: number
  screenHeight: number
  cornerRadius: number
  dynamicIsland: boolean
  /** 16e-style top notch instead of the Dynamic Island */
  notch?: boolean
  colors: { name: DeviceColor; label: string; frame: string; bezel: string }[]
}

const PRO_17_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'cosmic-orange', label: 'Orange cosmique', frame: '#C75B33', bezel: '#A84A28' },
  { name: 'deep-blue', label: 'Bleu profond', frame: '#3A4B63', bezel: '#2C3A4E' },
  { name: 'silver', label: 'Argent', frame: '#E3E2DD', bezel: '#C8C7C2' },
]

const IPHONE_17_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'lavender', label: 'Lavande', frame: '#C8B8D8', bezel: '#AE9CC2' },
  { name: 'sage', label: 'Sauge', frame: '#AEBE9C', bezel: '#96A484' },
  { name: 'mist-blue', label: 'Bleu brume', frame: '#A8BCD2', bezel: '#8FA4BE' },
  { name: 'white', label: 'Blanc', frame: '#F5F5F0', bezel: '#DDDDD8' },
  { name: 'black', label: 'Noir', frame: '#1C1C1C', bezel: '#111111' },
]

const IPHONE_AIR_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'sky-blue', label: 'Bleu ciel', frame: '#A5CFE3', bezel: '#8ABAD2' },
  { name: 'light-gold', label: 'Or clair', frame: '#E7D6B0', bezel: '#D4C096' },
  { name: 'cloud-white', label: 'Blanc nuage', frame: '#F2F1EA', bezel: '#D8D7D0' },
  { name: 'space-black', label: 'Noir sidéral', frame: '#232323', bezel: '#171717' },
]

const IPHONE_16_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'black', label: 'Noir', frame: '#1C1C1C', bezel: '#111111' },
  { name: 'white', label: 'Blanc', frame: '#F5F5F0', bezel: '#DDDDD8' },
  { name: 'teal', label: 'Sarcelle', frame: '#5AAFCB', bezel: '#3E96B0' },
  { name: 'pink', label: 'Rose', frame: '#F5A5B8', bezel: '#DE8DA0' },
  { name: 'ultramarine', label: 'Outremer', frame: '#4B50B5', bezel: '#363A96' },
]

const IPHONE_16E_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'black', label: 'Noir', frame: '#1C1C1C', bezel: '#111111' },
  { name: 'white', label: 'Blanc', frame: '#F5F5F0', bezel: '#DDDDD8' },
]

const TITANIUM_16_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'natural-titanium', label: 'Titane naturel', frame: '#8A8580', bezel: '#6E6A66' },
  { name: 'black-titanium', label: 'Titane noir', frame: '#3C3C3C', bezel: '#2A2A2A' },
  { name: 'white-titanium', label: 'Titane blanc', frame: '#E3E2DD', bezel: '#C8C7C2' },
  { name: 'desert-titanium', label: 'Titane désert', frame: '#BFB5A5', bezel: '#A8A090' },
]

/** Width/height follow real device aspect ratios. Insets ~5.5% / 4.7%. */
function frameConfig(
  model: DeviceModel,
  modelName: string,
  screenSize: string,
  width: number,
  height: number,
  colors: DeviceFrameConfig['colors'],
  options: { current?: boolean; notch?: boolean } = {},
): DeviceFrameConfig {
  const screenX = Math.round(width * 0.055)
  const screenY = Math.round(height * 0.047)
  return {
    model,
    modelName,
    screenSize,
    current: options.current ?? true,
    width,
    height,
    screenX,
    screenY,
    screenWidth: width - screenX * 2,
    screenHeight: height - screenY * 2,
    cornerRadius: Math.round(width * 0.155),
    dynamicIsland: !options.notch,
    ...(options.notch ? { notch: true } : {}),
    colors,
  }
}

// Current Apple lineup (apple.com/iphone/compare, July 2026), largest first.
export const DEVICE_FRAMES: DeviceFrameConfig[] = [
  frameConfig('iphone-17-pro-max', 'iPhone 17 Pro Max', '6.9"', 180, 379, PRO_17_COLORS),
  frameConfig('iphone-17-pro', 'iPhone 17 Pro', '6.3"', 172, 359, PRO_17_COLORS),
  frameConfig('iphone-17', 'iPhone 17', '6.3"', 172, 358, IPHONE_17_COLORS),
  frameConfig('iphone-air', 'iPhone Air', '6.5"', 172, 360, IPHONE_AIR_COLORS),
  frameConfig('iphone-16-plus', 'iPhone 16 Plus', '6.7"', 178, 368, IPHONE_16_COLORS),
  frameConfig('iphone-16', 'iPhone 16', '6.1"', 170, 350, IPHONE_16_COLORS),
  frameConfig('iphone-16e', 'iPhone 16e', '6.1"', 170, 349, IPHONE_16E_COLORS, { notch: true }),
  // Legacy — old projects only
  frameConfig('iphone-16-pro-max', 'iPhone 16 Pro Max', '6.9"', 180, 380, TITANIUM_16_COLORS, { current: false }),
  frameConfig('iphone-16-pro', 'iPhone 16 Pro', '6.3"', 170, 360, TITANIUM_16_COLORS, { current: false }),
]

export const CURRENT_DEVICE_FRAMES = DEVICE_FRAMES.filter((frame) => frame.current)

export const DEFAULT_DEVICE: DeviceFrameConfig = DEVICE_FRAMES[0]

export function getDeviceFrame(model: DeviceModel): DeviceFrameConfig {
  return DEVICE_FRAMES.find((f) => f.model === model) ?? DEFAULT_DEVICE
}

/** Canonical layer size for a model — official aspect, never user-distorted. */
export function getDefaultDeviceSize(model: DeviceModel): { width: number; height: number } {
  const config = getDeviceFrame(model)
  const height = 507
  return { width: Math.round(height * (config.width / config.height)), height }
}

export function generateDeviceFrameSVG(config: DeviceFrameConfig, colorName: DeviceColor, screenshotUrl?: string): string {
  const color = config.colors.find((c) => c.name === colorName) ?? config.colors[0]
  const { width, height, screenX, screenY, screenWidth, screenHeight, cornerRadius, dynamicIsland } = config

  // Dynamic island pill dimensions
  const pillWidth = 52
  const pillHeight = 14
  const pillX = (width - pillWidth) / 2
  const pillY = screenY + 6
  const pillRadius = pillHeight / 2

  // Notch (16e): centered dip from the top edge of the screen
  const notchWidth = Math.round(screenWidth * 0.52)
  const notchHeight = 16
  const notchX = (width - notchWidth) / 2
  const notchRadius = 8

  // Side buttons
  const btnWidth = 3
  const btnRadius = 1.5
  // Power button (right side)
  const powerBtnY = height * 0.28
  const powerBtnH = height * 0.1
  // Volume buttons (left side)
  const volUpY = height * 0.22
  const volUpH = height * 0.07
  const volDownY = height * 0.31
  const volDownH = height * 0.1
  // Silent switch (left side)
  const silentY = height * 0.15
  const silentH = height * 0.04

  const screenClipId = `screen-clip-${config.model}`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <clipPath id="${screenClipId}">
      <rect x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" rx="${cornerRadius - 4}" ry="${cornerRadius - 4}"/>
    </clipPath>
  </defs>

  <!-- Outer frame -->
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${cornerRadius}" ry="${cornerRadius}" fill="${color.frame}" stroke="${color.bezel}" stroke-width="1.5"/>

  <!-- Bezel inner -->
  <rect x="${screenX - 1}" y="${screenY - 1}" width="${screenWidth + 2}" height="${screenHeight + 2}" rx="${cornerRadius - 3}" ry="${cornerRadius - 3}" fill="${color.bezel}"/>

  <!-- Screen area (placeholder — filled by screenshot or dark) -->
  <rect x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" rx="${cornerRadius - 4}" ry="${cornerRadius - 4}" fill="#1A1A1A"/>

  ${screenshotUrl ? `<!-- Screenshot -->
  <image x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" href="${escapeSvgAttribute(screenshotUrl)}" clip-path="url(#${screenClipId})" preserveAspectRatio="xMidYMid slice"/>` : ''}

  <!-- Dynamic Island pill or notch -->
  ${dynamicIsland
    ? `<rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" ry="${pillRadius}" fill="#000000"/>`
    : `<path d="M ${notchX} ${screenY - 1} h ${notchWidth} v ${notchHeight - notchRadius} a ${notchRadius} ${notchRadius} 0 0 1 -${notchRadius} ${notchRadius} h -${notchWidth - notchRadius * 2} a ${notchRadius} ${notchRadius} 0 0 1 -${notchRadius} -${notchRadius} z" fill="#000000"/>`}

  <!-- Power button (right) -->
  <rect x="${width - 1}" y="${powerBtnY}" width="${btnWidth}" height="${powerBtnH}" rx="${btnRadius}" ry="${btnRadius}" fill="${color.bezel}"/>

  <!-- Silent switch (left) -->
  <rect x="${-btnWidth + 1}" y="${silentY}" width="${btnWidth}" height="${silentH}" rx="${btnRadius}" ry="${btnRadius}" fill="${color.bezel}"/>

  <!-- Volume up (left) -->
  <rect x="${-btnWidth + 1}" y="${volUpY}" width="${btnWidth}" height="${volUpH}" rx="${btnRadius}" ry="${btnRadius}" fill="${color.bezel}"/>

  <!-- Volume down (left) -->
  <rect x="${-btnWidth + 1}" y="${volDownY}" width="${btnWidth}" height="${volDownH}" rx="${btnRadius}" ry="${btnRadius}" fill="${color.bezel}"/>
</svg>`
}

function escapeSvgAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
