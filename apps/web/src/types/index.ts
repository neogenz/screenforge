// ─── Layer Types ────────────────────────────────────────────────────────────

export type LayerType = 'text' | 'device-frame' | 'image' | 'shape'

export interface BaseLayer {
  id: string
  type: LayerType
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  visible: boolean
  zIndex: number
  /** When 'layout', the layer appears on all screens */
  scope?: 'layout'
}

export interface ColorStop {
  offset: number // 0–1
  color: string // CSS color string
}

export interface GradientFill {
  type: 'linear' | 'radial'
  angle?: number // degrees, linear only
  centerX?: number // 0–100 percentage, radial only
  centerY?: number // 0–100 percentage, radial only
  stops: ColorStop[]
}

export interface TextShadow {
  offsetX: number
  offsetY: number
  blur: number
  color: string
}

export interface TextLayer extends BaseLayer {
  type: 'text'
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  textAlign: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  shadow?: TextShadow
  gradientFill?: GradientFill
}

export interface ImportedDeviceBezel {
  /** Asset id of the Apple-supplied transparent PNG (see lib/assets.ts). */
  assetId: string
  fileName: string
  naturalWidth: number
  naturalHeight: number
  /** Transparent display opening, in the PNG's natural pixel coordinates. */
  screen: { x: number; y: number; width: number; height: number }
}

export interface DeviceFrameLayer extends BaseLayer {
  type: 'device-frame'
  deviceModel: DeviceModel
  deviceColor: DeviceColor
  /** Applies to the generated frame only; imported Apple artwork is never rotated. */
  orientation: Orientation
  /** Optional Apple Product Bezel supplied locally by the user. */
  importedBezel?: ImportedDeviceBezel
  /** Asset id of the inserted app screenshot (see lib/assets.ts). */
  screenshotAssetId?: string
  shadowEnabled?: boolean
  shadowBlur?: number
  shadowColor?: string
  shadowOffsetX?: number
  shadowOffsetY?: number
}

export interface ImageLayer extends BaseLayer {
  type: 'image'
  /** Asset id of the image payload (see lib/assets.ts). */
  assetId: string
  originalWidth: number
  originalHeight: number
  shadow?: TextShadow
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape'
  shapeType: 'rectangle' | 'circle' | 'rounded-rect'
  fill: string | GradientFill
  stroke?: string
  strokeWidth?: number
  borderRadius?: number // rounded-rect only
  shadow?: TextShadow
}

export type Layer = TextLayer | DeviceFrameLayer | ImageLayer | ShapeLayer

// ─── Background ─────────────────────────────────────────────────────────────

export type Background =
  | { type: 'solid'; color: string }
  | { type: 'linear-gradient'; angle: number; stops: ColorStop[] }
  | { type: 'radial-gradient'; centerX?: number; centerY?: number; stops: ColorStop[] }

// ─── Screen & Project ───────────────────────────────────────────────────────

export interface Screen {
  id: string
  name: string
  layers: Layer[]
  background: Background
  thumbnail?: string // data URL for screens bar
}

export interface GlobalSettings {
  fontFamily: string
  fontWeight: number
  fontSize: number
  fontColor: string
  background: Background
  deviceModel: DeviceModel
  deviceColor: DeviceColor
}

export interface Project {
  id: string
  name: string
  screens: Screen[]
  activeScreenId: string
  globals: GlobalSettings
  /** Layers shared across all screens */
  layoutLayers: Layer[]
  createdAt: number
  updatedAt: number
}

// ─── Export ──────────────────────────────────────────────────────────────────

export interface ExportConfig {
  screenIds: string[]
  dimensions: DisplayClass[]
  format: 'png'
}

// ─── Device & Orientation ────────────────────────────────────────────────────

export type DeviceModel =
  | 'iphone-17-pro-max'
  | 'iphone-17-pro'
  | 'iphone-17'
  | 'iphone-air'
  | 'iphone-16-plus'
  | 'iphone-16'
  | 'iphone-16e'
  // Legacy — kept so older projects still render
  | 'iphone-16-pro-max'
  | 'iphone-16-pro'

export type DeviceColor =
  | 'cosmic-orange'
  | 'deep-blue'
  | 'silver'
  | 'lavender'
  | 'sage'
  | 'mist-blue'
  | 'sky-blue'
  | 'light-gold'
  | 'cloud-white'
  | 'space-black'
  | 'black-titanium'
  | 'white-titanium'
  | 'natural-titanium'
  | 'desert-titanium'
  | 'ultramarine'
  | 'teal'
  | 'pink'
  | 'white'
  | 'black'

export type Orientation = 'portrait' | 'landscape'

// ─── Display Class ───────────────────────────────────────────────────────────

export interface DisplayClass {
  name: string
  size: string // e.g. '6.9"'
  portrait: { width: number; height: number }
  landscape: { width: number; height: number }
  devices: string[]
  isPrimary: boolean
  isLegacy: boolean
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  thumbnail?: string
  layers: Layer[]
  background: Background
}
