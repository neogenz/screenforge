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

// Dans chaque jeu, `colors[0]` est la couleur retenue par défaut : un neutre,
// jamais une couleur vive. Les projets enregistrés stockent le nom, pas l'index.
const PRO_17_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'silver', label: 'Argent', frame: '#E3E2DD', bezel: '#C8C7C2' },
  { name: 'deep-blue', label: 'Bleu profond', frame: '#3A4B63', bezel: '#2C3A4E' },
  { name: 'cosmic-orange', label: 'Orange cosmique', frame: '#C75B33', bezel: '#A84A28' },
]

const IPHONE_17_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'black', label: 'Noir', frame: '#1C1C1C', bezel: '#111111' },
  { name: 'white', label: 'Blanc', frame: '#F5F5F0', bezel: '#DDDDD8' },
  { name: 'mist-blue', label: 'Bleu brume', frame: '#A8BCD2', bezel: '#8FA4BE' },
  { name: 'sage', label: 'Sauge', frame: '#AEBE9C', bezel: '#96A484' },
  { name: 'lavender', label: 'Lavande', frame: '#C8B8D8', bezel: '#AE9CC2' },
]

const IPHONE_AIR_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'space-black', label: 'Noir sidéral', frame: '#232323', bezel: '#171717' },
  { name: 'cloud-white', label: 'Blanc nuage', frame: '#F2F1EA', bezel: '#D8D7D0' },
  { name: 'light-gold', label: 'Or clair', frame: '#E7D6B0', bezel: '#D4C096' },
  { name: 'sky-blue', label: 'Bleu ciel', frame: '#A5CFE3', bezel: '#8ABAD2' },
]

const IPHONE_16_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'black', label: 'Noir', frame: '#1C1C1C', bezel: '#111111' },
  { name: 'white', label: 'Blanc', frame: '#F5F5F0', bezel: '#DDDDD8' },
  { name: 'teal', label: 'Sarcelle', frame: '#5AAFCB', bezel: '#3E96B0' },
  { name: 'ultramarine', label: 'Outremer', frame: '#4B50B5', bezel: '#363A96' },
  { name: 'pink', label: 'Rose', frame: '#F5A5B8', bezel: '#DE8DA0' },
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

/**
 * Bordure entre le bord du châssis et la dalle, en unités du gabarit.
 *
 * Elle n'est pas un pourcentage : chaque iPhone a une bordure physique propre
 * (~2,4 mm sur un 17 Pro Max, ~3,4 mm sur un 16e) alors que les corps varient
 * peu. Un ratio unique donnait 10 unités partout, soit près du double du réel —
 * c'est ce qui faisait ressembler le rendu à une coque, pas à un téléphone.
 *
 * Chaque valeur vient de (corps mm − dalle mm) / 2, converti par l'échelle du
 * gabarit. Le contrôle croisé tient : `hauteur mm × échelle` retombe sur la
 * hauteur en unités de chaque modèle à moins de 1,5 % près.
 */
interface FrameInsets {
  x: number
  y: number
}

function frameConfig(
  model: DeviceModel,
  modelName: string,
  screenSize: string,
  width: number,
  height: number,
  insets: FrameInsets,
  colors: DeviceFrameConfig['colors'],
  options: { current?: boolean; notch?: boolean } = {},
): DeviceFrameConfig {
  return {
    model,
    modelName,
    screenSize,
    current: options.current ?? true,
    width,
    height,
    screenX: insets.x,
    screenY: insets.y,
    screenWidth: width - insets.x * 2,
    screenHeight: height - insets.y * 2,
    cornerRadius: Math.round(width * 0.155),
    dynamicIsland: !options.notch,
    ...(options.notch ? { notch: true } : {}),
    colors,
  }
}

// Current Apple lineup (apple.com/iphone/compare, July 2026), largest first.
export const DEVICE_FRAMES: DeviceFrameConfig[] = [
  frameConfig('iphone-17-pro-max', 'iPhone 17 Pro Max', '6.9"', 180, 379, { x: 5.5, y: 5.9 }, PRO_17_COLORS),
  frameConfig('iphone-17-pro', 'iPhone 17 Pro', '6.3"', 172, 359, { x: 6.4, y: 6.3 }, PRO_17_COLORS),
  frameConfig('iphone-17', 'iPhone 17', '6.3"', 172, 358, { x: 5.9, y: 5.8 }, IPHONE_17_COLORS),
  frameConfig('iphone-air', 'iPhone Air', '6.5"', 172, 360, { x: 5.9, y: 5.9 }, IPHONE_AIR_COLORS),
  frameConfig('iphone-16-plus', 'iPhone 16 Plus', '6.7"', 178, 368, { x: 7.5, y: 7.5 }, IPHONE_16_COLORS),
  frameConfig('iphone-16', 'iPhone 16', '6.1"', 170, 350, { x: 7.7, y: 7.7 }, IPHONE_16_COLORS),
  frameConfig('iphone-16e', 'iPhone 16e', '6.1"', 170, 349, { x: 8.2, y: 8.2 }, IPHONE_16E_COLORS, { notch: true }),
  // Legacy — old projects only
  frameConfig('iphone-16-pro-max', 'iPhone 16 Pro Max', '6.9"', 180, 380, { x: 5.5, y: 5.4 }, TITANIUM_16_COLORS, { current: false }),
  frameConfig('iphone-16-pro', 'iPhone 16 Pro', '6.3"', 170, 360, { x: 5.8, y: 5.8 }, TITANIUM_16_COLORS, { current: false }),
]

export const CURRENT_DEVICE_FRAMES = DEVICE_FRAMES.filter((frame) => frame.current)

export const DEFAULT_DEVICE: DeviceFrameConfig = DEVICE_FRAMES[0]

/**
 * Marge de chaque côté du châssis, dans le viewBox, pour que les boutons
 * latéraux soient dessinés au lieu d'être rognés. Elle fait partie de la
 * taille rendue : tout calcul d'aspect ou d'échelle doit passer par
 * `getDeviceRenderSize`, jamais par `config.width` seul.
 */
/**
 * Saillie d'un bouton latéral hors du châssis (~0,5 mm sur un vrai appareil).
 * Le demi-point est voulu : multiplié par `DEVICE_RASTER_SCALE`, il garde une
 * taille de bitmap entière, donc pas de demi-pixel sur le bord du gabarit.
 */
const BUTTON_PROTRUSION = 1.25

export const DEVICE_BLEED = BUTTON_PROTRUSION

/**
 * Facteur de rastérisation du gabarit.
 *
 * Le SVG est converti en bitmap une fois, à sa taille naturelle (~184 unités de
 * large), puis agrandi par Fabric : à l'export 1320×2868 un iPhone de taille
 * par défaut occupe ~740 px, soit quatre fois la source. D'où le flou, visible
 * à l'écran comme dans le PNG livré.
 *
 * ponytail: 4× couvre net la taille par défaut ; un appareil étiré à la largeur
 * entière de la planche redeviendrait légèrement mou. Monter à 8 si le cas se
 * présente — c'est 4× la mémoire par bitmap.
 */
export const DEVICE_RASTER_SCALE = 4

/**
 * Coin en superellipse (|x/r|^n + |y/r|^n = 1) et non arc de cercle : c'est la
 * forme réelle des châssis Apple. Un `rx` de SVG trahit le gabarit au premier
 * regard, d'autant plus que la bordure est fine.
 */
const SQUIRCLE_EXPONENT = 5
const SQUIRCLE_STEPS = 8

interface Point { x: number; y: number }

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Quart de superellipse, de (r, 0) à (0, r) dans le repère local du coin. */
function squircleQuarter(radius: number): Point[] {
  const points: Point[] = []
  for (let step = 0; step <= SQUIRCLE_STEPS; step += 1) {
    const t = (step / SQUIRCLE_STEPS) * (Math.PI / 2)
    points.push({
      x: radius * Math.cos(t) ** (2 / SQUIRCLE_EXPONENT),
      y: radius * Math.sin(t) ** (2 / SQUIRCLE_EXPONENT),
    })
  }
  return points
}

/** Échantillons → cubiques Catmull-Rom : une courbe lisse avec peu de points. */
function smoothThrough(points: Point[]): string {
  let path = ''
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? points[i + 1]
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    path += ` C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`
  }
  return path
}

/**
 * Rectangle à coins continus. Les rectangles imbriqués (tranche, bezel, dalle)
 * partagent la même construction : leurs coins restent concentriques, ce qu'un
 * œil lit immédiatement comme « vrai objet » plutôt que « formes empilées ».
 */
export function squircleRect(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2))
  if (r === 0) return `M ${round(x)} ${round(y)} h ${round(width)} v ${round(height)} h ${round(-width)} Z`
  const quarter = squircleQuarter(r)
  // Chaque coin : centre, axe vers le point tangent « en x », axe « en y ».
  const corners: { cx: number; cy: number; ux: number; uy: number; reverse: boolean }[] = [
    { cx: x + width - r, cy: y + r, ux: 1, uy: -1, reverse: true },
    { cx: x + width - r, cy: y + height - r, ux: 1, uy: 1, reverse: false },
    { cx: x + r, cy: y + height - r, ux: -1, uy: 1, reverse: true },
    { cx: x + r, cy: y + r, ux: -1, uy: -1, reverse: false },
  ]
  const edgeStarts: Point[] = [
    { x: x + width - r, y },
    { x: x + width, y: y + height - r },
    { x: x + r, y: y + height },
    { x, y: y + r },
  ]

  let path = `M ${round(x + r)} ${round(y)}`
  for (let index = 0; index < corners.length; index += 1) {
    const edge = edgeStarts[index]
    path += ` L ${round(edge.x)} ${round(edge.y)}`
    const corner = corners[index]
    const mapped = quarter.map((point) => ({
      x: corner.cx + point.x * corner.ux,
      y: corner.cy + point.y * corner.uy,
    }))
    path += smoothThrough(corner.reverse ? [...mapped].reverse() : mapped)
  }
  return `${path} Z`
}

export function getDeviceFrame(model: DeviceModel): DeviceFrameConfig {
  return DEVICE_FRAMES.find((f) => f.model === model) ?? DEFAULT_DEVICE
}

/** Dimensions du SVG rendu, boutons latéraux compris. */
export function getDeviceRenderSize(config: DeviceFrameConfig): { width: number; height: number } {
  return { width: config.width + DEVICE_BLEED * 2, height: config.height }
}

/** Canonical layer size for a model — official aspect, never user-distorted. */
export function getDefaultDeviceSize(model: DeviceModel): { width: number; height: number } {
  const rendered = getDeviceRenderSize(getDeviceFrame(model))
  const height = 507
  return { width: Math.round(height * (rendered.width / rendered.height)), height }
}

/**
 * Décale une couleur hex vers le blanc (`amount > 0`) ou le noir (`amount < 0`),
 * proportionnellement à la marge restante : un châssis clair s'éclaircit peu,
 * un châssis noir garde du contraste.
 */
function shiftHex(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  return `#${channels
    .map((channel) => {
      const room = amount > 0 ? 255 - channel : channel
      const next = Math.round(Math.min(255, Math.max(0, channel + amount * room)))
      return next.toString(16).padStart(2, '0')
    })
    .join('')}`
}

export function generateDeviceFrameSVG(config: DeviceFrameConfig, colorName: DeviceColor, screenshotUrl?: string): string {
  const color = config.colors.find((c) => c.name === colorName) ?? config.colors[0]
  const { width, height, screenX, screenY, screenWidth, screenHeight, cornerRadius, dynamicIsland } = config

  // Le viewBox déborde du châssis : sans cette marge les boutons latéraux,
  // dessinés au-delà des bords, seraient rognés au rendu.
  const bleed = DEVICE_BLEED
  const svgWidth = width + bleed * 2

  // Îlot dynamique, proportionné à la dalle et non au châssis : ~125 pt de large
  // et ~36 pt de haut sur une dalle de 440 pt, posé ~11 pt sous son bord haut.
  const pillWidth = screenWidth * 0.284
  const pillHeight = screenWidth * 0.082
  const pillX = (width - pillWidth) / 2
  const pillY = screenY + screenWidth * 0.025
  const pillRadius = pillHeight / 2

  // Notch (16e): centered dip from the top edge of the screen
  const notchWidth = Math.round(screenWidth * 0.52)
  const notchHeight = 16
  const notchX = (width - notchWidth) / 2
  const notchRadius = 8

  // Boutons latéraux : la moitié visible dépasse, l'autre passe sous la tranche
  // pour que la pièce paraisse encastrée plutôt que collée sur le bord.
  const btnWidth = BUTTON_PROTRUSION * 2
  const btnRadius = 0.8
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
  const railId = `rail-${config.model}`
  const glassId = `glass-${config.model}`
  const buttonId = `button-${config.model}`

  const specular = shiftHex(color.frame, 0.42)
  const railEdge = shiftHex(color.bezel, -0.22)

  // Vu de face, la tranche métal n'occupe qu'une part de la bordure : le reste
  // est du bezel noir. L'ancien dessin faisait l'inverse — 7,5 unités de métal
  // pour 2,5 de noir — d'où l'aspect « coque en plastique ».
  const railWidth = Math.min(2.8, screenX * 0.45)
  const screenRadius = cornerRadius - screenX
  const bezelRadius = cornerRadius - railWidth

  const railPath = squircleRect(0.5, 0.5, width - 1, height - 1, cornerRadius - 0.5)
  const bezelPath = squircleRect(railWidth, railWidth, width - railWidth * 2, height - railWidth * 2, bezelRadius)
  const screenPath = squircleRect(screenX, screenY, screenWidth, screenHeight, screenRadius)
  const innerPath = squircleRect(screenX + 0.4, screenY + 0.4, screenWidth - 0.8, screenHeight - 0.8, screenRadius - 0.4)

  const sideButton = (y: number, h: number, side: 'left' | 'right') =>
    `<rect x="${round(side === 'left' ? -BUTTON_PROTRUSION : width - BUTTON_PROTRUSION)}" y="${round(y)}" width="${round(btnWidth)}" height="${round(h)}" rx="${btnRadius}" ry="${btnRadius}" fill="url(#${buttonId})"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-bleed} 0 ${svgWidth} ${height}" width="${svgWidth * DEVICE_RASTER_SCALE}" height="${height * DEVICE_RASTER_SCALE}">
  <defs>
    <clipPath id="${screenClipId}">
      <path d="${screenPath}"/>
    </clipPath>
    <!-- Tranche métal : sombre aux arêtes, réflexion spéculaire près des bords. -->
    <linearGradient id="${railId}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${railEdge}"/>
      <stop offset="0.035" stop-color="${color.bezel}"/>
      <stop offset="0.11" stop-color="${specular}"/>
      <stop offset="0.34" stop-color="${color.frame}"/>
      <stop offset="0.66" stop-color="${color.frame}"/>
      <stop offset="0.89" stop-color="${specular}"/>
      <stop offset="0.965" stop-color="${color.bezel}"/>
      <stop offset="1" stop-color="${railEdge}"/>
    </linearGradient>
    <linearGradient id="${buttonId}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${railEdge}"/>
      <stop offset="0.5" stop-color="${color.frame}"/>
      <stop offset="1" stop-color="${railEdge}"/>
    </linearGradient>
    <!--
      Reflet de verre serré contre le bord haut. Un lavis diagonal sur toute la
      dalle donnait un écran gris qui semble incurvé sur les côtés : la lecture
      immédiate est « Android à écran courbe », pas iPhone. De face, un iPhone
      est un rectangle noir plat.
    -->
    <linearGradient id="${glassId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="0.06" stop-color="#ffffff" stop-opacity="0.012"/>
      <stop offset="0.14" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Boutons latéraux, sous la tranche pour paraître encastrés -->
  ${sideButton(powerBtnY, powerBtnH, 'right')}
  ${sideButton(silentY, silentH, 'left')}
  ${sideButton(volUpY, volUpH, 'left')}
  ${sideButton(volDownY, volDownH, 'left')}

  <!-- Tranche -->
  <path d="${railPath}" fill="url(#${railId})" stroke="${railEdge}" stroke-width="0.6"/>

  <!-- Bezel : noir sur tout appareil réel, quelle que soit la couleur du châssis -->
  <path d="${bezelPath}" fill="#0B0B0D"/>

  <!-- Dalle : noir profond, pas un gris. Un gris lit comme un rendu 3D. -->
  <path d="${screenPath}" fill="#050506"/>

  ${screenshotUrl ? `<!-- Capture -->
  <image x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" href="${escapeSvgAttribute(screenshotUrl)}" clip-path="url(#${screenClipId})" preserveAspectRatio="xMidYMid slice"/>` : ''}

  <!-- Verre -->
  <path d="${screenPath}" fill="url(#${glassId})"/>

  <!-- Liseré interne : sépare la dalle du bezel -->
  <path d="${innerPath}" fill="none" stroke="#000000" stroke-opacity="0.55" stroke-width="0.8"/>

  <!-- Îlot dynamique avec objectif, ou encoche -->
  ${dynamicIsland
    ? `<rect x="${round(pillX)}" y="${round(pillY)}" width="${round(pillWidth)}" height="${round(pillHeight)}" rx="${round(pillRadius)}" ry="${round(pillRadius)}" fill="#000000"/>
  <circle cx="${round(pillX + pillWidth - pillHeight / 2 - 0.8)}" cy="${round(pillY + pillHeight / 2)}" r="${round(pillHeight * 0.19)}" fill="#101116"/>
  <circle cx="${round(pillX + pillWidth - pillHeight / 2 - 0.8)}" cy="${round(pillY + pillHeight / 2)}" r="${round(pillHeight * 0.1)}" fill="#05050A"/>`
    : `<path d="M ${notchX} ${screenY - 1} h ${notchWidth} v ${notchHeight - notchRadius} a ${notchRadius} ${notchRadius} 0 0 1 -${notchRadius} ${notchRadius} h -${notchWidth - notchRadius * 2} a ${notchRadius} ${notchRadius} 0 0 1 -${notchRadius} -${notchRadius} z" fill="#000000"/>`}
</svg>`
}

function escapeSvgAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
