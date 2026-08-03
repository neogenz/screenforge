import {
  Circle,
  FabricImage,
  FabricObject,
  Gradient,
  Rect,
  Shadow,
  Textbox,
  controlsUtils,
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
import { DEFAULT_CANVAS_SHADOW_COLOR, DEFAULT_DEVICE_SCREEN_COLOR } from '@/lib/content-defaults'
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
 * Habillage de la sélection.
 *
 * Ces couleurs ne suivent pas le thème, et c'est délibéré : le cadre est posé
 * sur le contenu de l'utilisateur, pas sur le chrome de l'application. Un cadre
 * qui suivait le thème devenait blanc sur blanc dès qu'un artboard était clair
 * en thème sombre — la sélection disparaissait purement et simplement.
 *
 * La paire trait clair sur halo sombre reste lisible sur n'importe quel fond ;
 * c'est la convention des outils de recadrage, et elle ne coûte rien puisque
 * `lib/export.ts` reconstruit un `StaticCanvas` distinct, sans contrôles.
 */
const SELECTION_INK = '#ffffff'
const SELECTION_HALO = 'rgba(0,0,0,0.6)'
/** Épaisseur du halo de part et d'autre du trait clair, en pixels. */
const HALO_SPREAD = 1
/** Tranche voisine d'un calque partagé : présente, jamais saisissable. */
const GHOST_INK = 'rgba(255,255,255,0.6)'
const GHOST_HALO = 'rgba(0,0,0,0.3)'

const SELECTION_GEOMETRY = {
  cornerSize: 9,
  touchCornerSize: 22,
  cornerStyle: 'circle',
  transparentCorners: false,
  borderScaleFactor: 1,
  borderOpacityWhenMoving: 0.5,
  padding: 0,
  borderColor: SELECTION_INK,
  cornerColor: SELECTION_INK,
  cornerStrokeColor: SELECTION_HALO,
} as const

/**
 * Une poignée ne s'affiche que si elle fait quelque chose. Les milieux d'arête
 * étirent hors ratio : sur un cadre d'appareil le ratio est officiel, sur un
 * texte la hauteur découle du contenu. Les montrer promettait un geste que
 * l'objet refuse, et encombrait la sélection de huit points au lieu de quatre.
 */
const EDGE_HANDLES = { ml: false, mr: false, mt: false, mb: false }
const CORNER_HANDLES = ['tl', 'tr', 'bl', 'br'] as const

function scaleWithoutUniformToggle(
  ...args: Parameters<typeof controlsUtils.scalingEqually>
): ReturnType<typeof controlsUtils.scalingEqually> {
  const canvas = args[1].target.canvas
  if (!canvas || !('uniScaleKey' in canvas)) return controlsUtils.scalingEqually(...args)
  const uniScaleKey = canvas.uniScaleKey
  canvas.uniScaleKey = null
  try {
    return controlsUtils.scalingEqually(...args)
  } finally {
    canvas.uniScaleKey = uniScaleKey
  }
}

export function applySelectionStyle(
  object: FabricObject,
  layerType?: Layer['type'],
  officialBezel = false,
): void {
  object.set(SELECTION_GEOMETRY)
  if (layerType === 'device-frame') {
    object.setControlsVisibility({ ...EDGE_HANDLES, mtr: !officialBezel })
    if (officialBezel) {
      for (const handle of CORNER_HANDLES) {
        object.controls[handle].actionHandler = scaleWithoutUniformToggle
      }
    }
  }
  // Un texte se laisse élargir, jamais étirer en hauteur.
  else if (layerType === 'text') object.setControlsVisibility({ mt: false, mb: false })
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

// ─── Sélection : bicolore, écrêtée à la planche ──────────────────────────────

type ControlRenderer = (
  ctx: CanvasRenderingContext2D,
  styleOverride?: Record<string, unknown>,
) => void

type ControlHost = FabricObject & { _renderControls: ControlRenderer }

const renderControlsPlain =
  (FabricObject.prototype as unknown as ControlHost)._renderControls

/**
 * Trace le cadre en deux passes : un halo sombre plus large, puis le trait
 * clair par-dessus. C'est ce qui rend la sélection lisible aussi bien sur un
 * artboard blanc que sur un artboard noir.
 *
 * `ctx.lineWidth` est lu sur l'objet et non sur le style surchargé, d'où le
 * réglage temporaire de `borderScaleFactor` : Fabric n'expose pas l'épaisseur
 * du cadre autrement. Les poignées, elles, sont déjà bicolores par
 * construction — pastille claire, liseré sombre — et n'ont pas besoin des deux
 * passes, on les réserve donc à la seconde.
 */
function renderTwoTone(
  object: FabricObject,
  ctx: CanvasRenderingContext2D,
  styleOverride: Record<string, unknown> | undefined,
  ink: string,
  halo: string,
): void {
  const width = object.borderScaleFactor
  object.borderScaleFactor = width + HALO_SPREAD * 2
  renderControlsPlain.call(object, ctx, {
    ...styleOverride,
    hasControls: false,
    borderColor: halo,
  })
  object.borderScaleFactor = width
  renderControlsPlain.call(object, ctx, { ...styleOverride, borderColor: ink })
}

// Défaut global : couvre l'ActiveSelection d'une multi-sélection, qui n'est pas
// un calque et ne passe donc jamais par `applySelectionStyle`.
;(FabricObject.prototype as unknown as ControlHost)._renderControls =
  function renderTwoToneControls(ctx, styleOverride) {
    renderTwoTone(this, ctx, styleOverride, SELECTION_INK, SELECTION_HALO)
  }

/** Restreint le tracé à la fenêtre d'une planche, en coordonnées canvas. */
function clipToScreen(
  ctx: CanvasRenderingContext2D,
  object: FabricObject,
  screenIndex: number,
): void {
  const [a, b, c, d, e, f] = object.getViewportTransform()
  const transform = ctx.getTransform()
  ctx.transform(a, b, c, d, e, f)
  ctx.beginPath()
  ctx.rect(getScreenOffset(screenIndex), 0, SCREEN_WIDTH, SCREEN_HEIGHT)
  ctx.clip()
  // Le tracé de Fabric applique lui-même le transform de vue : on lui rend le
  // contexte tel qu'il l'attend. L'écrêtage, lui, est figé en espace device.
  ctx.setTransform(transform)
}

/**
 * Écrête les poignées et le cadre de sélection à la planche de l'objet.
 *
 * Le contenu est déjà écrêté par `clipPath` : sans le même traitement ici, un
 * calque qui déborde de sa planche recevait un cadre plus grand que ce qui est
 * dessiné. Le cas limite est le calque partagé (« Partager partout ») : il vit
 * dans un espace continu qui saute les gouttières, donc ses instances sont
 * décalées les unes des autres d'une gouttière. Aucun rectangle unique ne
 * coïncide alors avec les tranches visibles, et le cadre pleine largeur se lit
 * comme un sélecteur cassé — c'est ce que montrait la capture de l'utilisateur.
 *
 * Les autres tranches du même calque reçoivent un liseré atténué : elles disent
 * que l'objet continue sur la planche voisine, sans prétendre être saisissables.
 */
export function clipControlsToScreen(object: RenderedObject, screenIndex: number): void {
  const target = object as RenderedObject & ControlHost
  target._renderControls = function renderClippedControls(ctx, styleOverride) {
    ctx.save()
    clipToScreen(ctx, this, screenIndex)
    renderTwoTone(this, ctx, styleOverride, SELECTION_INK, SELECTION_HALO)
    ctx.restore()

    const layerId = this.data?.layerId
    if (!this.data?.layout || !layerId || !this.canvas) return
    for (const sibling of this.canvas.getObjects() as RenderedObject[]) {
      if (sibling === this || sibling.data?.layerId !== layerId) continue
      const siblingScreen = sibling.data?.screenIndex
      if (siblingScreen === undefined) continue
      ctx.save()
      clipToScreen(ctx, sibling, siblingScreen)
      // La couleur, pas `globalAlpha` : le tracé de Fabric remet l'alpha à 1.
      renderTwoTone(sibling, ctx, { hasControls: false }, GHOST_INK, GHOST_HALO)
      ctx.restore()
    }
  }
}

/**
 * Écrête le contenu d'un calque à la fenêtre de sa planche.
 *
 * Par `ctx.clip()` et non par la propriété `clipPath` de Fabric. Dès qu'un
 * `clipPath` est posé, `needsItsOwnCache()` renvoie vrai : l'objet est peint
 * dans une surface intermédiaire, puis recopiée sur la planche à un décalage
 * fractionnaire en filtrage bilinéaire. Le bord des glyphes est alors lissé
 * deux fois. Mesuré sur un titre de 48 unités à 63 % de zoom : 0,49 pixel
 * intermédiaire par pixel d'encre en passant par le cache, 0,27 en rendu
 * direct — c'est le flou que montrait la capture. Le réglage `objectCaching`
 * ne suffit pas : `needsItsOwnCache()` passe devant.
 */
export function clipContentToScreen(object: RenderedObject, screenIndex: number): void {
  const renderPlain = Object.getPrototypeOf(object).render as FabricObject['render']
  object.render = function renderClipped(ctx: CanvasRenderingContext2D) {
    ctx.save()
    // Le contexte est déjà en coordonnées de scène ici — Fabric applique le
    // transform de vue avant de parcourir les objets. Contrairement au tracé
    // des poignées, qui lui arrive en espace device, il n'y a rien à composer.
    ctx.beginPath()
    ctx.rect(getScreenOffset(screenIndex), 0, SCREEN_WIDTH, SCREEN_HEIGHT)
    ctx.clip()
    renderPlain.call(this, ctx)
    ctx.restore()
  }
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
  const imported = layer.importedBezel
  const importedUrl = resolveAsset(imported?.assetId)
  if (imported && importedUrl) {
    const screenshotUrl = resolveAsset(layer.screenshotAssetId)
    const escape = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const { naturalWidth: width, naturalHeight: height, screen } = imported
    return {
      width,
      height,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${screenshotUrl
    ? `<image x="${screen.x}" y="${screen.y}" width="${screen.width}" height="${screen.height}" href="${escape(screenshotUrl)}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${screen.x}" y="${screen.y}" width="${screen.width}" height="${screen.height}" fill="${DEFAULT_DEVICE_SCREEN_COLOR}"/>`}
  <image x="0" y="0" width="${width}" height="${height}" href="${escape(importedUrl)}"/>
</svg>`,
    }
  }

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
    if (layer.importedBezel && resolveAsset(layer.importedBezel.assetId)) {
      return [
        'device',
        'imported',
        layer.importedBezel.assetId,
        layer.screenshotAssetId ?? '',
      ].join(':')
    }
    return [
      'device',
      'generated',
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

  // Rendu direct sur la planche, sans surface intermédiaire. Le cache d'objet
  // de Fabric est fait pour des scènes à des centaines d'objets qu'on repeint
  // sans les modifier ; ici il n'économise rien et sa recopie, posée à un
  // décalage fractionnaire, lisse le bord des glyphes une seconde fois. À
  // l'export en 1320×2868, le couper fait tomber le lissage de 0,21 à 0,10
  // pixel intermédiaire par pixel d'encre — et le PNG de 86 à 68 ko, un bord
  // net se compressant mieux qu'un dégradé.
  object.objectCaching = false
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
  const officialBezel = layer.type === 'device-frame' && Boolean(layer.importedBezel)
  object.set({
    // Origine au centre : une rotation pivote le calque sur lui-même au lieu de
    // le faire tourner autour de son coin, ce qui l'éjectait de l'artboard.
    // `layer.x` / `layer.y` restent le coin haut-gauche de la boîte non pivotée.
    originX: 'center',
    originY: 'center',
    angle: officialBezel ? 0 : layer.rotation,
    opacity: officialBezel ? 1 : layer.opacity,
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
      lockRotation: officialBezel,
      scaleX: layer.width / Math.max(1, object.width),
      scaleY: layer.height / Math.max(1, object.height),
      shadow: !officialBezel && layer.shadowEnabled
        ? new Shadow({
            blur: layer.shadowBlur ?? 20,
            color: layer.shadowColor ?? DEFAULT_CANVAS_SHADOW_COLOR,
            offsetX: layer.shadowOffsetX ?? 0,
            offsetY: layer.shadowOffsetY ?? 12,
          })
        : null,
    })
  }

  applySelectionStyle(object, layer.type, officialBezel)

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
