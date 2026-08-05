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
  colors: { name: DeviceColor; label: string; frame: string }[]
}

// Dans chaque jeu, `colors[0]` est la couleur retenue par défaut : un neutre,
// jamais une couleur vive. Les projets enregistrés stockent le nom, pas l'index.
const PRO_17_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'silver', label: 'Argent', frame: '#ffffff' },
  { name: 'deep-blue', label: 'Bleu profond', frame: '#3A4B63' },
  { name: 'cosmic-orange', label: 'Orange cosmique', frame: '#C75B33' },
]

const IPHONE_17_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'white', label: 'Blanc', frame: '#ffffff' },
  { name: 'black', label: 'Noir', frame: '#1C1C1C' },
  { name: 'mist-blue', label: 'Bleu brume', frame: '#A8BCD2' },
  { name: 'sage', label: 'Sauge', frame: '#AEBE9C' },
  { name: 'lavender', label: 'Lavande', frame: '#C8B8D8' },
]

const IPHONE_AIR_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'cloud-white', label: 'Blanc nuage', frame: '#ffffff' },
  { name: 'space-black', label: 'Noir sidéral', frame: '#232323' },
  { name: 'light-gold', label: 'Or clair', frame: '#E7D6B0' },
  { name: 'sky-blue', label: 'Bleu ciel', frame: '#A5CFE3' },
]

const IPHONE_16_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'white', label: 'Blanc', frame: '#ffffff' },
  { name: 'black', label: 'Noir', frame: '#1C1C1C' },
  { name: 'teal', label: 'Sarcelle', frame: '#5AAFCB' },
  { name: 'ultramarine', label: 'Outremer', frame: '#4B50B5' },
  { name: 'pink', label: 'Rose', frame: '#F5A5B8' },
]

const IPHONE_16E_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'white', label: 'Blanc', frame: '#ffffff' },
  { name: 'black', label: 'Noir', frame: '#1C1C1C' },
]

const TITANIUM_16_COLORS: DeviceFrameConfig['colors'] = [
  { name: 'white-titanium', label: 'Titane blanc', frame: '#ffffff' },
  { name: 'natural-titanium', label: 'Titane naturel', frame: '#8A8580' },
  { name: 'black-titanium', label: 'Titane noir', frame: '#3C3C3C' },
  { name: 'desert-titanium', label: 'Titane désert', frame: '#BFB5A5' },
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
  frameConfig(
    'iphone-17-pro-max',
    'iPhone 17 Pro Max',
    '6.9"',
    180,
    379,
    { x: 5.5, y: 5.9 },
    PRO_17_COLORS,
  ),
  frameConfig(
    'iphone-17-pro',
    'iPhone 17 Pro',
    '6.3"',
    172,
    359,
    { x: 6.4, y: 6.3 },
    PRO_17_COLORS,
  ),
  frameConfig('iphone-17', 'iPhone 17', '6.3"', 172, 358, { x: 5.9, y: 5.8 }, IPHONE_17_COLORS),
  frameConfig('iphone-air', 'iPhone Air', '6.5"', 172, 360, { x: 5.9, y: 5.9 }, IPHONE_AIR_COLORS),
  frameConfig(
    'iphone-16-plus',
    'iPhone 16 Plus',
    '6.7"',
    178,
    368,
    { x: 7.5, y: 7.5 },
    IPHONE_16_COLORS,
  ),
  frameConfig('iphone-16', 'iPhone 16', '6.1"', 170, 350, { x: 7.7, y: 7.7 }, IPHONE_16_COLORS),
  frameConfig('iphone-16e', 'iPhone 16e', '6.1"', 170, 349, { x: 8.2, y: 8.2 }, IPHONE_16E_COLORS, {
    notch: true,
  }),
  // Legacy — old projects only
  frameConfig(
    'iphone-16-pro-max',
    'iPhone 16 Pro Max',
    '6.9"',
    180,
    380,
    { x: 5.5, y: 5.4 },
    TITANIUM_16_COLORS,
    { current: false },
  ),
  frameConfig(
    'iphone-16-pro',
    'iPhone 16 Pro',
    '6.3"',
    170,
    360,
    { x: 5.8, y: 5.8 },
    TITANIUM_16_COLORS,
    { current: false },
  ),
]

export const CURRENT_DEVICE_FRAMES = DEVICE_FRAMES.filter((frame) => frame.current)

export const DEFAULT_DEVICE: DeviceFrameConfig = DEVICE_FRAMES[0]

/**
 * Facteur de rastérisation du gabarit.
 *
 * Le SVG est converti en bitmap une fois, à sa taille naturelle (~180 unités de
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
 * Coin continu à la manière d'iOS : superellipse |x/a|^n + |y/a|^n = 1, et non
 * arc de cercle. Un `rx` de SVG trahit le gabarit au premier regard.
 *
 * Les deux constantes vont ensemble et se règlent ensemble. À exposant 5 et
 * demi-axe égal au rayon, le coin passe à 0,18·r de l'angle quand un arc de
 * cercle passe à 0,41·r : la silhouette obtenue est *plus carrée* qu'un rayon
 * ordinaire, soit l'inverse de l'effet recherché — c'est ce qui faisait lire
 * une dalle Android. iOS étale le coin sur ~1,53× le rayon nominal, ce qui
 * relâche la tension à la jonction avec le flanc tout en gardant l'angle rond.
 */
const SQUIRCLE_EXPONENT = 4
const SQUIRCLE_SPREAD = 1.528
const SQUIRCLE_STEPS = 12

interface Point {
  x: number
  y: number
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Quart de superellipse, de (a, 0) à (0, a) dans le repère local du coin.
 *
 * `outer` donne la courbe de référence : le quart renvoyé est sa parallèle
 * intérieure, à la distance `outer − extent`. Se contenter de réduire le
 * demi-axe épaissit la bordure dans les angles — mesuré à 3,5 unités contre
 * 2,25 sur les flancs, soit +56 % — et ce biseau est exactement ce qui fait
 * lire des formes empilées au lieu d'un objet.
 */
function squircleQuarter(extent: number, outer: number = extent): Point[] {
  const distance = outer - extent
  const exponent = 2 / SQUIRCLE_EXPONENT
  const points: Point[] = []
  for (let step = 0; step <= SQUIRCLE_STEPS; step += 1) {
    const t = (step / SQUIRCLE_STEPS) * (Math.PI / 2)
    const x = outer * Math.cos(t) ** exponent
    const y = outer * Math.sin(t) ** exponent
    if (distance === 0) {
      points.push({ x, y })
      continue
    }
    // Normale sortante de |x/r|^n + |y/r|^n = 1, soit le gradient ∝ (x^(n-1), y^(n-1)).
    const nx = x ** (SQUIRCLE_EXPONENT - 1)
    const ny = y ** (SQUIRCLE_EXPONENT - 1)
    const length = Math.hypot(nx, ny) || 1
    points.push({ x: x - (nx / length) * distance, y: y - (ny / length) * distance })
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
export function squircleRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  /** Rayon de la silhouette dont ce rectangle est la parallèle intérieure. */
  outerRadius: number = radius,
): string {
  if (radius <= 0)
    return `M ${round(x)} ${round(y)} h ${round(width)} v ${round(height)} h ${round(-width)} Z`

  // Le coin s'étale sur `SQUIRCLE_SPREAD` fois le rayon nominal : c'est là que
  // la courbe rejoint le flanc droit, donc là que commencent les segments.
  const inset = Math.max(0, outerRadius - radius)
  const outerExtent = (radius + inset) * SQUIRCLE_SPREAD
  const r = Math.min(outerExtent - inset, Math.min(width, height) / 2)
  const quarter = squircleQuarter(r, r + inset)
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

/** Dimensions du SVG rendu. */
export function getDeviceRenderSize(config: DeviceFrameConfig): { width: number; height: number } {
  return { width: config.width, height: config.height }
}

/** Canonical layer size for a model — official aspect, never user-distorted. */
export function getDefaultDeviceSize(model: DeviceModel): { width: number; height: number } {
  const rendered = getDeviceRenderSize(getDeviceFrame(model))
  const height = 507
  return { width: Math.round(height * (rendered.width / rendered.height)), height }
}

export function generateDeviceFrameSVG(
  config: DeviceFrameConfig,
  colorName: DeviceColor,
  screenshotUrl?: string,
): string {
  const color = config.colors.find((c) => c.name === colorName) ?? config.colors[0]
  const {
    width,
    height,
    screenX,
    screenY,
    screenWidth,
    screenHeight,
    cornerRadius,
    dynamicIsland,
  } = config

  // Îlot dynamique, proportionné à la dalle et non au châssis : 125 pt de large
  // et 36,7 pt de haut sur une dalle de 402 pt, posé 11 pt sous son bord haut.
  // Il doit flotter : collé au bezel il se lit comme une encoche, donc Android.
  const pillWidth = screenWidth * 0.311
  const pillHeight = screenWidth * 0.091
  const pillX = (width - pillWidth) / 2
  const pillY = screenY + screenWidth * 0.027
  const pillRadius = pillHeight / 2

  // Encoche (16e) : 162 pt de large et 32 pt de haut sur une dalle de 390 pt,
  // soit 0,415 et 0,082 de sa largeur. Elle était donnée à 0,52 de large et à
  // une hauteur absolue de 16 unités, indépendante du modèle — une encoche
  // d'un tiers trop large se lit comme un gabarit générique, pas comme un
  // iPhone.
  const notchWidth = Math.round(screenWidth * 0.415)
  const notchHeight = screenWidth * 0.082
  const notchX = (width - notchWidth) / 2
  const notchRadius = notchHeight / 2

  const screenClipId = `screen-clip-${config.model}`
  const screenRadius = cornerRadius - screenX
  const framePath = squircleRect(0, 0, width, height, cornerRadius)
  const screenPath = squircleRect(
    screenX,
    screenY,
    screenWidth,
    screenHeight,
    screenRadius,
    cornerRadius,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * DEVICE_RASTER_SCALE}" height="${height * DEVICE_RASTER_SCALE}">
  <defs>
    <clipPath id="${screenClipId}">
      <path d="${screenPath}"/>
    </clipPath>
  </defs>

  <path data-part="frame" d="${framePath}" fill="${color.frame}"/>
  <path data-part="screen" d="${screenPath}" fill="#050506"/>

  ${screenshotUrl ? `<image data-part="screenshot" x="${screenX}" y="${screenY}" width="${screenWidth}" height="${screenHeight}" href="${escapeSvgAttribute(screenshotUrl)}" clip-path="url(#${screenClipId})" preserveAspectRatio="xMidYMid slice"/>` : ''}

  <!--
    Îlot dynamique, ou encoche.

    L'îlot n'est dessiné que sur un appareil vide. Une capture prise sur un
    iPhone à îlot le contient déjà : la dalle est un rectangle plein et le
    système compose la pastille noire dans le tampon d'affichage, donc dans le
    PNG. La redessiner par-dessus en superposait une seconde, à nos
    proportions et non aux siennes — d'où la marche noire au sommet de l'écran.

    L'encoche, elle, reste dessinée dans tous les cas : sur un appareil à
    encoche la découpe est physique, le tampon derrière contient le fond de
    l'app, et la capture ne porte donc aucun noir à cet endroit.
  -->
  ${
    !dynamicIsland
      ? `<path data-part="notch" d="M ${notchX} ${screenY - 1} h ${notchWidth} v ${notchHeight - notchRadius} a ${notchRadius} ${notchRadius} 0 0 1 -${notchRadius} ${notchRadius} h -${notchWidth - notchRadius * 2} a ${notchRadius} ${notchRadius} 0 0 1 -${notchRadius} -${notchRadius} z" fill="#000000"/>`
      : screenshotUrl
        ? ''
        : `<rect data-part="island" x="${round(pillX)}" y="${round(pillY)}" width="${round(pillWidth)}" height="${round(pillHeight)}" rx="${round(pillRadius)}" ry="${round(pillRadius)}" fill="#000000"/>`
  }
</svg>`
}

function escapeSvgAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
