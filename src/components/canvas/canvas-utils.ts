import {
  Circle,
  FabricImage,
  FabricObject,
  Gradient,
  Rect,
  Shadow,
  Textbox,
  util,
} from 'fabric'
import {
  DEVICE_BLEED,
  DEVICE_RASTER_SCALE,
  generateDeviceFrameSVG,
  getDeviceFrame,
  getDeviceRenderSize,
} from '@/assets/device-frames'
import { resolveAsset } from '@/lib/assets'
import { DEFAULT_CANVAS_SHADOW_COLOR } from '@/lib/content-defaults'
import type {
  Background,
  BaseLayer,
  DeviceFrameLayer,
  GradientFill,
  Layer,
  TextLayer,
  TextShadow,
} from '@/types'

export const SCREEN_WIDTH = 440
export const SCREEN_HEIGHT = 956
export const SCREEN_GAP = 40

FabricObject.ownDefaults.originX = 'left'
FabricObject.ownDefaults.originY = 'top'

/**
 * Habillage de la sélection : géométrie fixe, couleurs pilotées par le thème.
 * Rien de tout ceci n'atteint l'export — `lib/export.ts` reconstruit un
 * `StaticCanvas` distinct à partir des données de calque, sans contrôles.
 */
const SELECTION_GEOMETRY = {
  cornerSize: 8,
  cornerStyle: 'circle',
  transparentCorners: false,
  cornerStrokeColor: '#000000',
  borderScaleFactor: 1.5,
  borderOpacityWhenMoving: 0.5,
  padding: 0,
} as const

let selectionColors = { border: '#f7f7f7', corner: '#f7f7f7', cornerStroke: '#252525' }

/** Relu au changement de thème : les poignées suivent `--color-selection`. */
export function setSelectionColors(next: typeof selectionColors): void {
  selectionColors = next
}

export function applySelectionStyle(object: FabricObject): void {
  object.set({
    ...SELECTION_GEOMETRY,
    borderColor: selectionColors.border,
    cornerColor: selectionColors.corner,
    cornerStrokeColor: selectionColors.cornerStroke,
  })
}

export type RenderedObject = FabricObject & {
  data?: {
    uid?: string
    layerId?: string
    screenId?: string
    screenIndex?: number
    clipScreenIndex?: number
    layout?: boolean
    rendererType?: Layer['type'] | 'background' | 'label'
    resourceKey?: string
    objectUrl?: string
  }
}

export function getScreenOffset(index: number): number {
  return index * (SCREEN_WIDTH + SCREEN_GAP)
}

export function getTotalWidth(screenCount: number): number {
  return screenCount < 1
    ? SCREEN_WIDTH
    : screenCount * SCREEN_WIDTH + (screenCount - 1) * SCREEN_GAP
}

function createShadow(shadow?: TextShadow): Shadow | null {
  return shadow
    ? new Shadow({
        offsetX: shadow.offsetX,
        offsetY: shadow.offsetY,
        blur: shadow.blur,
        color: shadow.color,
      })
    : null
}

function createGradient(fill: GradientFill): Gradient<'linear'> | Gradient<'radial'> {
  if (fill.type === 'radial') {
    const centerX = (fill.centerX ?? 50) / 100
    const centerY = (fill.centerY ?? 50) / 100
    return new Gradient<'radial'>({
      type: 'radial',
      gradientUnits: 'percentage',
      coords: {
        x1: centerX,
        y1: centerY,
        r1: 0,
        x2: centerX,
        y2: centerY,
        r2: 0.5,
      },
      colorStops: fill.stops,
    })
  }

  const radians = ((fill.angle ?? 90) * Math.PI) / 180
  const dx = Math.sin(radians) / 2
  const dy = -Math.cos(radians) / 2
  return new Gradient<'linear'>({
    type: 'linear',
    gradientUnits: 'percentage',
    coords: {
      x1: 0.5 - dx,
      y1: 0.5 - dy,
      x2: 0.5 + dx,
      y2: 0.5 + dy,
    },
    colorStops: fill.stops,
  })
}

export function backgroundToFabricFill(background: Background) {
  if (background.type === 'solid') return background.color
  return createGradient({
    type: background.type === 'linear-gradient' ? 'linear' : 'radial',
    angle: background.type === 'linear-gradient' ? background.angle : undefined,
    centerX: background.type === 'radial-gradient' ? background.centerX : undefined,
    centerY: background.type === 'radial-gradient' ? background.centerY : undefined,
    stops: background.stops,
  })
}

function transformText(layer: TextLayer): string {
  if (layer.textTransform === 'uppercase') return layer.content.toUpperCase()
  if (layer.textTransform === 'lowercase') return layer.content.toLowerCase()
  if (layer.textTransform === 'capitalize') {
    return layer.content.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
  }
  return layer.content
}

function orientedDeviceSvg(layer: DeviceFrameLayer): {
  svg: string
  width: number
  height: number
} {
  const config = getDeviceFrame(layer.deviceModel)
  const portraitSvg = generateDeviceFrameSVG(
    config,
    layer.deviceColor,
    resolveAsset(layer.screenshotAssetId),
  )
  const rendered = getDeviceRenderSize(config)
  if (layer.orientation === 'portrait') {
    return { svg: portraitSvg, width: rendered.width, height: rendered.height }
  }

  const contentStart = portraitSvg.indexOf('>') + 1
  const contentEnd = portraitSvg.lastIndexOf('</svg>')
  const content = portraitSvg.slice(contentStart, contentEnd)
  // Rotation de 90° autour de l'origine puis translation : (x, y) → (height - y, x).
  // Le contenu portrait s'étend de -DEVICE_BLEED à width + DEVICE_BLEED en x,
  // ce débordement se retrouve donc en y une fois couché.
  return {
    width: rendered.height,
    height: rendered.width,
    // Même facteur de rastérisation que le portrait : sinon un appareil couché
    // serait quatre fois moins net que le même appareil debout.
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-DEVICE_BLEED} ${config.height} ${rendered.width}" width="${config.height * DEVICE_RASTER_SCALE}" height="${rendered.width * DEVICE_RASTER_SCALE}"><g transform="translate(${config.height} 0) rotate(90)">${content}</g></svg>`,
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image resource: ${src.slice(0, 80)}`))
    image.src = src
  })
}

function getResourceKey(layer: Layer): string {
  if (layer.type === 'image') return `image:${layer.assetId}`
  if (layer.type === 'device-frame') {
    return [
      'device',
      layer.deviceModel,
      layer.deviceColor,
      layer.orientation,
      layer.screenshotAssetId ?? '',
    ].join(':')
  }
  if (layer.type === 'shape') return `shape:${layer.shapeType}`
  return layer.type
}

export function disposeFabricObjectResource(object: RenderedObject): void {
  const objectUrl = object.data?.objectUrl
  if (objectUrl) URL.revokeObjectURL(objectUrl)
}

export function needsFabricObjectRecreation(object: RenderedObject, layer: Layer): boolean {
  return object.data?.rendererType !== layer.type
    || object.data?.resourceKey !== getResourceKey(layer)
}

export async function layerToFabricObject(layer: Layer): Promise<RenderedObject> {
  let object: RenderedObject
  let objectUrl: string | undefined

  if (layer.type === 'text') {
    object = new Textbox('', { width: Math.max(1, layer.width) })
  } else if (layer.type === 'shape') {
    object = layer.shapeType === 'circle'
      ? new Circle({ radius: 1 })
      : new Rect()
  } else if (layer.type === 'image') {
    const src = resolveAsset(layer.assetId)
    if (!src) throw new Error('Image introuvable : asset manquant dans le registre.')
    const image = await loadImage(src)
    object = new FabricImage(image)
  } else {
    const device = orientedDeviceSvg(layer)
    const blob = new Blob([device.svg], { type: 'image/svg+xml' })
    objectUrl = URL.createObjectURL(blob)
    try {
      const image = await loadImage(objectUrl)
      object = new FabricImage(image)
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  object.set('data', {
    uid: layer.id,
    rendererType: layer.type,
    resourceKey: getResourceKey(layer),
    ...(objectUrl ? { objectUrl } : {}),
  })
  applyLayerToFabricObject(object, layer)
  return object
}

export function applyLayerToFabricObject(
  object: RenderedObject,
  layer: Layer,
  screenOffset = 0,
): void {
  object.set({
    // Origine au centre : une rotation pivote le calque sur lui-même au lieu de
    // le faire tourner autour de son coin, ce qui l'éjectait de l'artboard.
    // `layer.x` / `layer.y` restent le coin haut-gauche de la boîte non pivotée.
    originX: 'center',
    originY: 'center',
    angle: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    selectable: !layer.locked,
    evented: !layer.locked,
    hasControls: !layer.locked,
    hoverCursor: layer.locked ? 'not-allowed' : 'move',
  })

  if (layer.type === 'text' && object instanceof Textbox) {
    object.set({
      text: transformText(layer),
      width: Math.max(1, layer.width),
      scaleX: 1,
      scaleY: 1,
      lockScalingY: true,
      fontSize: layer.fontSize,
      fontFamily: layer.fontFamily,
      fontWeight: layer.fontWeight.toString(),
      fill: layer.gradientFill ? createGradient(layer.gradientFill) : layer.color,
      textAlign: layer.textAlign,
      lineHeight: layer.lineHeight,
      // `charSpacing` de Fabric se compte en millièmes de cadratin, le champ de
      // l'interface en pixels. Passer la valeur brute donnait 0,002 em pour un
      // réglage de 2 px : le contrôle ne faisait visiblement rien.
      charSpacing: (layer.letterSpacing / layer.fontSize) * 1000,
      shadow: createShadow(layer.shadow),
    })
    object.initDimensions()
  } else if (layer.type === 'shape') {
    const fill = typeof layer.fill === 'string' ? layer.fill : createGradient(layer.fill)
    object.set({
      fill,
      stroke: layer.stroke ?? null,
      strokeWidth: layer.strokeWidth ?? 0,
      shadow: createShadow(layer.shadow),
    })
    if (object instanceof Circle) {
      const diameter = Math.max(1, Math.min(layer.width, layer.height))
      object.set({
        radius: diameter / 2,
        scaleX: layer.width / diameter,
        scaleY: layer.height / diameter,
      })
    } else if (object instanceof Rect) {
      const radius = layer.shapeType === 'rounded-rect' ? layer.borderRadius ?? 8 : 0
      object.set({
        width: Math.max(1, layer.width),
        height: Math.max(1, layer.height),
        scaleX: 1,
        scaleY: 1,
        rx: radius,
        ry: radius,
      })
    }
  } else if (layer.type === 'image' && object instanceof FabricImage) {
    object.set({
      scaleX: layer.width / Math.max(1, object.width),
      scaleY: layer.height / Math.max(1, object.height),
      shadow: createShadow(layer.shadow),
    })
  } else if (layer.type === 'device-frame' && object instanceof FabricImage) {
    object.set({
      // Official device aspect ratio — canvas scaling stays proportional.
      lockUniScaling: true,
      scaleX: layer.width / Math.max(1, object.width),
      scaleY: layer.height / Math.max(1, object.height),
      shadow: layer.shadowEnabled
        ? new Shadow({
            blur: layer.shadowBlur ?? 20,
            color: layer.shadowColor ?? DEFAULT_CANVAS_SHADOW_COLOR,
            offsetX: layer.shadowOffsetX ?? 0,
            offsetY: layer.shadowOffsetY ?? 12,
          })
        : null,
    })
  }

  applySelectionStyle(object)

  // La taille vient d'être posée : le centre s'en déduit, jamais l'inverse.
  const size = scaledSize(object, Math.abs(object.scaleX), Math.abs(object.scaleY))
  object.set({
    left: layer.x + screenOffset + size.width / 2,
    top: layer.y + size.height / 2,
  })

  object.setCoords()
}

/**
 * Taille occupée par l'objet, hors rotation. Un Textbox garde sa hauteur
 * intrinsèque : elle découle du texte, pas d'une mise à l'échelle verticale.
 */
function scaledSize(
  object: RenderedObject,
  scaleX: number,
  scaleY: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, object.width * scaleX),
    height: Math.max(1, object.height * (object instanceof Textbox ? 1 : scaleY)),
  }
}

export function fabricObjectToLayerUpdate(
  object: RenderedObject,
  screenOffset = 0,
): Partial<BaseLayer> {
  const matrix = object.calcTransformMatrix()
  const decomposition = util.qrDecompose(matrix)
  const size = scaledSize(object, Math.abs(decomposition.scaleX), Math.abs(decomposition.scaleY))
  // La translation d'une matrice Fabric est toujours le centre de l'objet,
  // y compris à l'intérieur d'une ActiveSelection.
  const [centerX, centerY] = [matrix[4], matrix[5]]

  return {
    x: centerX - size.width / 2 - screenOffset,
    y: centerY - size.height / 2,
    ...size,
    rotation: decomposition.angle,
    opacity: object.opacity,
  }
}
