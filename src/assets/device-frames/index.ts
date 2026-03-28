import type { DeviceModel, DeviceColor } from '@/types'

export interface DeviceFrameConfig {
  model: DeviceModel
  modelName: string
  width: number
  height: number
  screenX: number
  screenY: number
  screenWidth: number
  screenHeight: number
  cornerRadius: number
  dynamicIsland: boolean
  colors: { name: DeviceColor; label: string; frame: string; bezel: string }[]
}

export const DEVICE_FRAMES: DeviceFrameConfig[] = [
  {
    model: 'iphone-16-pro-max',
    modelName: 'iPhone 16 Pro Max',
    width: 180,
    height: 380,
    screenX: 10,
    screenY: 18,
    screenWidth: 160,
    screenHeight: 344,
    cornerRadius: 28,
    dynamicIsland: true,
    colors: [
      { name: 'natural-titanium', label: 'Natural Titanium', frame: '#8A8580', bezel: '#6E6A66' },
      { name: 'black-titanium', label: 'Black Titanium', frame: '#3C3C3C', bezel: '#2A2A2A' },
      { name: 'white-titanium', label: 'White Titanium', frame: '#E3E2DD', bezel: '#C8C7C2' },
      { name: 'desert-titanium', label: 'Desert Titanium', frame: '#BFB5A5', bezel: '#A8A090' },
    ],
  },
  {
    model: 'iphone-16-pro',
    modelName: 'iPhone 16 Pro',
    width: 170,
    height: 360,
    screenX: 9,
    screenY: 17,
    screenWidth: 152,
    screenHeight: 326,
    cornerRadius: 26,
    dynamicIsland: true,
    colors: [
      { name: 'natural-titanium', label: 'Natural Titanium', frame: '#8A8580', bezel: '#6E6A66' },
      { name: 'black-titanium', label: 'Black Titanium', frame: '#3C3C3C', bezel: '#2A2A2A' },
      { name: 'white-titanium', label: 'White Titanium', frame: '#E3E2DD', bezel: '#C8C7C2' },
      { name: 'desert-titanium', label: 'Desert Titanium', frame: '#BFB5A5', bezel: '#A8A090' },
    ],
  },
  {
    model: 'iphone-16',
    modelName: 'iPhone 16',
    width: 165,
    height: 345,
    screenX: 9,
    screenY: 16,
    screenWidth: 147,
    screenHeight: 313,
    cornerRadius: 32,
    dynamicIsland: true,
    colors: [
      { name: 'black', label: 'Black', frame: '#1C1C1C', bezel: '#111111' },
      { name: 'white', label: 'White', frame: '#F5F5F0', bezel: '#DDDDD8' },
      { name: 'teal', label: 'Teal', frame: '#5AAFCB', bezel: '#3E96B0' },
      { name: 'pink', label: 'Pink', frame: '#F5A5B8', bezel: '#DE8DA0' },
      { name: 'ultramarine', label: 'Ultramarine', frame: '#4B50B5', bezel: '#363A96' },
    ],
  },
]

export const DEFAULT_DEVICE: DeviceFrameConfig = DEVICE_FRAMES[0]

export function getDeviceFrame(model: DeviceModel): DeviceFrameConfig {
  return DEVICE_FRAMES.find((f) => f.model === model) ?? DEFAULT_DEVICE
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
  <image x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" href="${screenshotUrl}" clip-path="url(#${screenClipId})" preserveAspectRatio="xMidYMid slice"/>` : ''}

  <!-- Dynamic island pill -->
  ${dynamicIsland ? `<rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" ry="${pillRadius}" fill="#000000"/>` : `<circle cx="${width / 2}" cy="${screenY + 12}" r="5" fill="${color.bezel}"/>`}

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
