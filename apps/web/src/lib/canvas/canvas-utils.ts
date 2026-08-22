import {
  Circle,
  FabricImage,
  FabricObject,
  Gradient,
  Path,
  Point,
  Rect,
  Shadow,
  Textbox,
  controlsUtils,
  util,
} from 'fabric'
import {
  DEVICE_RASTER_SCALE,
  generateDeviceFrameSVG,
  getDeviceFrame,
  getDeviceRenderSize,
  screenshotImage,
} from '@/assets/device-frames'
import { resolveAsset } from '@/lib/assets'
import { DEFAULT_CANVAS_SHADOW_COLOR, DEFAULT_DEVICE_SCREEN_COLOR } from '@/lib/content-defaults'
import { normalizeScreenshotPlacement } from '@/lib/screenshot-placement'
import { ICON_STROKE, iconEntry, shapeEntry } from '@/lib/vector-catalog'
import {
  GHOST_HALO,
  GHOST_INK,
  SELECTION_HALO,
  SELECTION_INK,
  renderTwoTone,
  type ControlHost,
} from '@/lib/canvas/controls-patch'
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
    clipScreenCount?: number
    layout?: boolean
    rendererType?: Layer['type'] | 'background' | 'label'
    resourceKey?: string
    objectUrl?: string
    /** La largeur que le calque déclare, opposable à celle que Fabric mesure. */
    declaredWidth?: number
  }
}

/**
 * Réenrouler un texte sans lui laisser choisir sa largeur.
 *
 * `Textbox.initDimensions` remonte `width` à `dynamicMinWidth` — la largeur du
 * plus long mot — dès qu'un mot dépasse la boîte. Cette largeur-là n'est pas une
 * donnée du projet : elle sort d'une mesure, donc de la police effectivement
 * chargée à cet instant. Et elle ne reste pas sur l'objet : `object:modified`
 * relit la géométrie par `fabricObjectToLayerUpdate`, si bien qu'un simple
 * déplacement gravait dans le projet une largeur née d'une police de secours,
 * différente d'un navigateur à l'autre et exportée telle quelle.
 *
 * La restaurer ne change pas la coupe : `_wrapLine` enroule déjà au
 * `Math.max(desiredWidth, largestWordWidth)`, donc le mot trop long occupait
 * déjà sa ligne à lui. Ce qui change, c'est la boîte annoncée — celle que le
 * panneau Transformation affiche — et donc l'origine du rendu. Un mot plus large
 * que sa boîte déborde désormais à droite plutôt que de l'élargir en silence :
 * c'est le débordement que la revue de locales existe à signaler.
 */
export function rewrapTextbox(object: Textbox & RenderedObject): void {
  const center = object.getCenterPoint()
  const previousHeight = object.height
  object.initDimensions()
  const declared = object.data?.declaredWidth
  // `_set` et non `set`, et c'est tout l'enjeu : `Textbox.textLayoutProperties`
  // déclare `width`, donc `FabricText.set` rappelle `initDimensions`, qui
  // regonfle aussitôt à `dynamicMinWidth` — la restauration rebondissait sans
  // rien changer, dans le seul cas pour lequel elle existe. `_set` est le
  // setter que `initDimensions` emploie lui-même sur ce même champ, une ligne
  // plus haut dans Fabric. `declared-width.test.ts` épingle cette raison au
  // contrat de Fabric plutôt qu'à ce commentaire.
  if (declared !== undefined && object.width !== declared) {
    ;(object as unknown as FabricInternalSetter)._set('width', declared)
  }
  const heightDelta = object.height - previousHeight
  if (Number.isFinite(heightDelta) && heightDelta !== 0) {
    placeAtSceneCenter(object, center.x, center.y + heightDelta / 2)
  }
  object.setCoords()
}

/** Le setter interne de Fabric, absent de ses déclarations publiques. */
interface FabricInternalSetter {
  _set(key: string, value: unknown): void
}

export function getScreenOffset(index: number): number {
  return index * (SCREEN_WIDTH + SCREEN_GAP)
}

/**
 * Le nom d'une planche se lit à l'écran, pas dans la scène.
 *
 * Il n'appartient pas à la composition : il désigne la planche, comme le
 * ferait une étiquette posée à côté. Rendu en unités de scène il suivait le
 * zoom — à 65 %, douze unités font 7,8 px, illisible ; à 400 %, 48 px, un
 * titre qui domine le visuel qu'il nomme. Les deux valeurs sont donc divisées
 * par le zoom pour rendre 12 px de texte à 26 px au-dessus du bord, quel que
 * soit le facteur.
 */
export const SCREEN_LABEL_FONT_SIZE = 12
export const SCREEN_LABEL_OFFSET = 26

/** @param zoom facteur du viewport Fabric */
export function screenLabelGeometry(zoom: number): { fontSize: number; top: number } {
  const factor = zoom > 0 ? zoom : 1
  return { fontSize: SCREEN_LABEL_FONT_SIZE / factor, top: -SCREEN_LABEL_OFFSET / factor }
}

/**
 * Remet les étiquettes de planche à leur taille écran.
 *
 * Rien dans Fabric ne dit « cet objet ignore le viewport » : la taille est
 * recalculée à chaque changement de zoom. Rend `true` si quelque chose a
 * bougé, pour que l'appelant sache s'il doit redessiner.
 */
export function scaleScreenLabels(
  canvas: { getObjects: () => FabricObject[] },
  zoom: number,
): boolean {
  const { fontSize, top } = screenLabelGeometry(zoom)
  let changed = false
  for (const object of canvas.getObjects() as RenderedObject[]) {
    if (object.data?.rendererType !== 'label') continue
    if (object.get('fontSize') === fontSize && object.top === top) continue
    object.set({ fontSize, top })
    object.setCoords()
    changed = true
  }
  return changed
}

// ─── Hors planche : ce qui est sorti du cadre, et ce qu'il en reste ──────────

/**
 * Ce qui reste d'un calque une fois sorti de sa planche.
 *
 * Une planche ne montre que ce qui lui appartient — c'est ce que l'export
 * livrera, et une planche qui montre autre chose ment sur son propre contenu.
 * Mais ce qui en sort n'est pas supprimé pour autant : le calque est toujours
 * dans la liste, il porte toujours son texte, et il suffit de le ramener. Le
 * couper net revenait à répondre « effacé » à un geste qui voulait dire
 * « déplacé ». Mesuré : un calque posé hors de sa planche devenait invisible
 * partout, tout en restant cliquable au-dessus de la planche VOISINE, où il
 * volait le clic destiné au calque de celle-ci.
 *
 * Un quart, et pas la moitié : il faut lire au premier coup d'œil que ce n'est
 * pas de la composition. Le grain de la scène est à 5,5 % — à 25 % le fantôme
 * s'en détache nettement sans jamais se confondre avec un calque posé.
 */
export const OFFBOARD_OPACITY = 0.25

/**
 * De quoi couvrir la scène bien au-delà de ce qu'un calque peut atteindre.
 *
 * Le fantôme est écrêté au complément des planches, et un complément a besoin
 * d'un contour extérieur. Il est large plutôt que calculé sur la boîte de
 * l'objet, parce qu'une ombre portée déborde de cette boîte-là sans que Fabric
 * le dise : `getBoundingRect` ignore `shadow`.
 */
const STAGE_REACH = 100_000

/**
 * Une marge d'un demi-pixel avant de déclarer qu'un calque déborde.
 *
 * Le liseré d'un tracé mord d'un demi-pixel de part et d'autre de sa boîte. Sans
 * cette marge, un calque calé pile sur le bord de sa planche déclencherait une
 * seconde passe de rendu à chaque image, pour un fantôme large de rien.
 */
const OFFBOARD_EPSILON = 0.5

/** Le calque sort-il, si peu que ce soit, de la fenêtre de sa planche ? */
export function escapesScreen(object: FabricObject, screenIndex: number): boolean {
  const bounds = object.getBoundingRect()
  const left = getScreenOffset(screenIndex)
  return (
    bounds.left < left - OFFBOARD_EPSILON ||
    bounds.top < -OFFBOARD_EPSILON ||
    bounds.left + bounds.width > left + SCREEN_WIDTH + OFFBOARD_EPSILON ||
    bounds.top + bounds.height > SCREEN_HEIGHT + OFFBOARD_EPSILON
  )
}

/**
 * Ce qu'il faut de recouvrement pour qu'un calque reste saisissable.
 *
 * En deçà, la prise serait un ruban de quelques pixels : on viserait une chose
 * pour en attraper une autre.
 */
const MIN_GRABBABLE = 8

interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** Le rectangle a-t-il de quoi être attrapé sur une planche posée en `boardLeft` ? */
function grabbable(box: Box, boardLeft: number): boolean {
  const overlapX =
    Math.min(box.left + box.width, boardLeft + SCREEN_WIDTH) - Math.max(box.left, boardLeft)
  const overlapY = Math.min(box.top + box.height, SCREEN_HEIGHT) - Math.max(box.top, 0)
  return overlapX > MIN_GRABBABLE && overlapY > MIN_GRABBABLE
}

/** Le calque a-t-il de quoi être attrapé sur la fenêtre de sa planche ? */
export function intersectsScreen(object: FabricObject, screenIndex: number): boolean {
  return grabbable(object.getBoundingRect(), getScreenOffset(screenIndex))
}

/**
 * Le calque est-il devenu hors de prise sur sa planche ?
 *
 * Lu sur la boîte déclarée — celle que les champs X et Y du panneau affichent —
 * et non sur la boîte que Fabric mesure, parce que c'est ce couple de nombres
 * que l'utilisateur a sous les yeux quand la question se pose. Les coordonnées
 * d'un calque sont locales à sa planche, d'où la planche prise en zéro.
 *
 * C'est le même seuil que `intersectsScreen`, et il le faut : cette fonction dit
 * exactement quand le panneau doit offrir le retour, c'est-à-dire quand le
 * canevas vient de retirer la prise. Un pixel d'écart entre les deux laisserait
 * un calque injoignable sans rien pour le rappeler.
 */
export function layerOutOfReach(layer: Pick<BaseLayer, 'x' | 'y' | 'width' | 'height'>): boolean {
  return !grabbable({ left: layer.x, top: layer.y, width: layer.width, height: layer.height }, 0)
}

/** Où poser le calque pour qu'il tienne entier sur sa planche. */
export function clampLayerToBoard(layer: Pick<BaseLayer, 'x' | 'y' | 'width' | 'height'>): {
  x: number
  y: number
} {
  const clamp = (value: number, extent: number, size: number) =>
    Math.round(Math.min(Math.max(value, 0), Math.max(0, extent - size)))
  return {
    x: clamp(layer.x, SCREEN_WIDTH, layer.width),
    y: clamp(layer.y, SCREEN_HEIGHT, layer.height),
  }
}

/**
 * Restreint le tracé à la scène : tout sauf les planches.
 *
 * Toutes les planches, et pas seulement la sienne. Mesuré sur le canevas vivant :
 * les fonds occupent les indices 0 à N-1 et **tous** les calques viennent après,
 * donc un fantôme laissé libre se peindrait par-dessus la planche voisine quelle
 * que soit la direction — il n'y a pas de côté où l'ordre de peinture le
 * sauverait. Et la pellicule le cuirait dans la vignette de cette voisine :
 * `install-thumbnails` ne fait qu'un seul `renderAll()` puis recadre l'image
 * obtenue planche par planche, si bien qu'à l'instant du recadrage il n'y a plus
 * d'objet à filtrer. Écrêter ici est donc la seule barrière, et elle tient les
 * deux à la fois — l'écran et la vignette — sans drapeau à lever ni à rabaisser.
 *
 * Règle de remplissage « evenodd » : les rectangles des planches sont disjoints,
 * donc un point du contour extérieur qui tombe dans l'un d'eux est traversé deux
 * fois et sort du tracé. C'est exactement le complément voulu.
 */
function clipToStage(ctx: CanvasRenderingContext2D, screenCount: number): void {
  ctx.beginPath()
  ctx.rect(-STAGE_REACH, -STAGE_REACH, STAGE_REACH * 2, STAGE_REACH * 2)
  for (let index = 0; index < screenCount; index += 1) {
    ctx.rect(getScreenOffset(index), 0, SCREEN_WIDTH, SCREEN_HEIGHT)
  }
  ctx.clip('evenodd')
}

// ─── Sélection : bicolore, écrêtée à la planche ──────────────────────────────

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
 * Le cadre en pointillé d'un calque qu'on ne peut plus attraper.
 *
 * Le fantôme seul ne suffit pas, et c'est mesuré : il est peint avec l'encre du
 * calque, mais sur la scène et non sur la planche qui lui donnait son fond. Une
 * accroche presque noire atténuée à un quart compose à 1,05:1 sur la scène
 * sombre — invisible — et une accroche blanche ferait exactement la même chose
 * sur la scène claire. La lisibilité du fantôme dépendrait donc des couleurs du
 * projet et du thème de l'application, ce qui n'est pas une garantie.
 *
 * Le cadre n'apparaît qu'une fois la prise perdue, jamais au premier
 * débordement : un calque qui mord volontairement sur le bord reste visible et
 * saisissable sur sa planche, et l'entourer à chaque fois ne ferait que du
 * bruit. Quand il ne reste plus rien à attraper, en revanche, il faut pouvoir le
 * retrouver — et la paire trait clair sur halo sombre se lit sur n'importe quel
 * fond, c'est déjà la raison pour laquelle la sélection l'emploie.
 *
 * Les épaisseurs sont divisées par le zoom : le contexte est en coordonnées de
 * scène, où un trait de 1 se réduirait au quart de pixel à 25 % de zoom.
 */
function strokeLostFrame(ctx: CanvasRenderingContext2D, object: FabricObject): void {
  const bounds = object.getBoundingRect()
  const zoom = object.getViewportTransform()[0] || 1
  ctx.save()
  ctx.setLineDash([6 / zoom, 4 / zoom])
  ctx.lineWidth = 3 / zoom
  ctx.strokeStyle = SELECTION_HALO
  ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height)
  ctx.lineWidth = 1 / zoom
  ctx.strokeStyle = SELECTION_INK
  ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height)
  ctx.restore()
}

/**
 * Peint un calque en deux temps : net sur sa planche, fantôme sur la scène.
 *
 * Deux passes et non une, parce que ce sont deux affirmations différentes. La
 * première dit ce que la planche contient — donc ce que l'export livrera. La
 * seconde dit où est passé le reste, sans prétendre qu'il compte. Voir
 * `OFFBOARD_OPACITY` pour ce que le fantôme corrige, et `clipToStage` pour
 * pourquoi il ne peut pas déborder sur la planche d'à côté.
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
export function clipContentToScreen(
  object: RenderedObject,
  screenIndex: number,
  screenCount: number,
): void {
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

    /* Puis ce qui dépasse, sur la scène et atténué. La seconde passe ne coûte
       que pour les calques qui débordent vraiment, et un calque qui déborde est
       l'exception — c'est pour ça que la garde est en tête plutôt qu'un
       écrêtage systématique en deux temps.

       Par `this.opacity` et non par `ctx.globalAlpha` : `_setOpacity` de Fabric
       **écrase** l'alpha du contexte dès que l'objet a un groupe et que sa
       transformation court (`ctx.globalAlpha = this.getObjectOpacity()`), ce qui
       est précisément le cas d'une sélection multiple en cours de glissement —
       le fantôme y serait repassé à pleine opacité. `this.opacity` alimente les
       deux branches, celle du groupe comme celle de l'objet seul, et compose
       avec l'opacité que l'utilisateur a réglée sur son calque. */
    if (!escapesScreen(this, screenIndex)) return
    const opacity = this.opacity
    ctx.save()
    try {
      clipToStage(ctx, screenCount)
      this.opacity = opacity * OFFBOARD_OPACITY
      renderPlain.call(this, ctx)
      this.opacity = opacity
      if (!intersectsScreen(this, screenIndex)) strokeLostFrame(ctx, this)
    } finally {
      this.opacity = opacity
      ctx.restore()
    }
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

/** La casse rendue, pas celle saisie — la mesure d'un texte doit lire la même. */
export function transformText(layer: TextLayer): string {
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
    const escape = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    const { naturalWidth: width, naturalHeight: height, screen } = imported
    /* L'ouverture d'un bezel Apple est un rectangle mesuré par remplissage
       (`device-bezel.ts`), pas une courbe : le découpage est donc un `rect`, et
       ce sont les coins opaques du PNG qui redonnent l'arrondi. Il n'existait
       pas — le PNG posé par-dessus suffisait tant que la capture ne pouvait pas
       dépasser l'ouverture, ce qu'un zoom rend possible. */
    const screenClipId = `bezel-clip-${layer.id}`
    return {
      width,
      height,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs><clipPath id="${screenClipId}"><rect x="${screen.x}" y="${screen.y}" width="${screen.width}" height="${screen.height}"/></clipPath></defs>
  ${
    screenshotUrl
      ? screenshotImage(screenshotUrl, screen, layer.placement, layer.screenshotSize, screenClipId)
      : `<rect x="${screen.x}" y="${screen.y}" width="${screen.width}" height="${screen.height}" fill="${DEFAULT_DEVICE_SCREEN_COLOR}"/>`
  }
  <image x="0" y="0" width="${width}" height="${height}" href="${escape(importedUrl)}"/>
</svg>`,
    }
  }

  const config = getDeviceFrame(layer.deviceModel)
  const portraitSvg = generateDeviceFrameSVG(
    config,
    layer.deviceColor,
    resolveAsset(layer.screenshotAssetId),
    layer.placement,
    layer.screenshotSize,
  )
  const rendered = getDeviceRenderSize(config)
  if (layer.orientation === 'portrait') {
    return { svg: portraitSvg, width: rendered.width, height: rendered.height }
  }

  const contentStart = portraitSvg.indexOf('>') + 1
  const contentEnd = portraitSvg.lastIndexOf('</svg>')
  const content = portraitSvg.slice(contentStart, contentEnd)
  // Rotation de 90° autour de l'origine puis translation : (x, y) → (height - y, x).
  return {
    width: rendered.height,
    height: rendered.width,
    // Même facteur de rastérisation que le portrait : sinon un appareil couché
    // serait quatre fois moins net que le même appareil debout.
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${config.height} ${rendered.width}" width="${config.height * DEVICE_RASTER_SCALE}" height="${rendered.width * DEVICE_RASTER_SCALE}"><g transform="translate(${config.height} 0) rotate(90)">${content}</g></svg>`,
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

/**
 * Le cadrage fait partie de l'identité de la ressource.
 *
 * L'appareil est rasterisé une fois puis réutilisé tant que sa clé ne change
 * pas. Le cadrage est écrit dans le SVG, donc dans le raster : oublié ici, un
 * curseur de zoom déplacé ne repeindrait rien tant que la capture ou le modèle
 * n'aurait pas bougé.
 */
function placementKey(layer: DeviceFrameLayer): string {
  if (!layer.screenshotAssetId) return ''
  const { mode, focusX, focusY, zoom } = normalizeScreenshotPlacement(layer.placement)
  const size = layer.screenshotSize
  return [mode, focusX, focusY, zoom, size?.width ?? '', size?.height ?? ''].join(',')
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
        placementKey(layer),
      ].join(':')
    }
    return [
      'device',
      'generated',
      layer.deviceModel,
      layer.deviceColor,
      layer.orientation,
      layer.screenshotAssetId ?? '',
      placementKey(layer),
    ].join(':')
  }
  if (layer.type === 'shape') return `shape:${layer.shapeType}`
  if (layer.type === 'icon') return `icon:${layer.iconId}`
  return layer.type
}

export function disposeFabricObjectResource(object: RenderedObject): void {
  const objectUrl = object.data?.objectUrl
  if (objectUrl) URL.revokeObjectURL(objectUrl)
}

export function needsFabricObjectRecreation(object: RenderedObject, layer: Layer): boolean {
  return (
    object.data?.rendererType !== layer.type || object.data?.resourceKey !== getResourceKey(layer)
  )
}

export async function layerToFabricObject(layer: Layer): Promise<RenderedObject> {
  let object: RenderedObject
  let objectUrl: string | undefined

  if (layer.type === 'text') {
    object = new Textbox('', { width: Math.max(1, layer.width) })
  } else if (layer.type === 'shape') {
    const traced = shapeEntry(layer.shapeType)?.path
    if (traced) object = new Path(traced, { strokeUniform: true })
    else if (layer.shapeType === 'circle') object = new Circle({ radius: 1 })
    else object = new Rect()
  } else if (layer.type === 'icon') {
    // Un identifiant inconnu ne doit rien casser : le catalogue rend l'étoile.
    const traced = iconEntry(layer.iconId)?.path ?? iconEntry('star')!.path
    // Pas de `strokeUniform` ici, au contraire des formes : le trait d'une
    // icône grandit avec elle, comme le ferait le SVG dont il sort. Figé, une
    // icône de 200 px se rendrait au fil de fer.
    object = new Path(traced, { strokeLineCap: 'round', strokeLineJoin: 'round' })
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
    // `instanceof` réduit au type de Fabric et perd `data` au passage.
    const textbox = object as Textbox & RenderedObject
    const declaredWidth = Math.max(1, layer.width)
    // La largeur déclarée voyage avec l'objet : la remesure déclenchée par
    // l'arrivée d'une police n'a pas le calque sous la main, et ne doit pas
    // avoir à consulter le projet pour savoir ce que l'utilisateur a posé.
    textbox.set('data', { ...textbox.data, declaredWidth })
    object.set({
      text: transformText(layer),
      width: declaredWidth,
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
      // Copie et non référence : Fabric décale ces index pendant la frappe, et
      // il le ferait dans le projet lui-même — une mutation hors transaction,
      // invisible de l'historique. `transformText` change la casse sans changer
      // la longueur, donc les index restent ceux du contenu.
      styles: structuredClone(layer.charStyles ?? {}),
    })
    rewrapTextbox(textbox)
  } else if (layer.type === 'shape') {
    const fill = typeof layer.fill === 'string' ? layer.fill : createGradient(layer.fill)
    object.set({
      fill,
      stroke: layer.stroke ?? null,
      strokeWidth: layer.strokeWidth ?? 0,
      shadow: createShadow(layer.shadow),
    })
    if (object instanceof Path) {
      // Le tracé est figé dans sa boîte de 100 : redimensionner met à l'échelle,
      // ne retrace pas — sans quoi chaque pixel de poignée reconstruirait l'objet.
      object.set({
        scaleX: layer.width / Math.max(1, object.width),
        scaleY: layer.height / Math.max(1, object.height),
      })
    } else if (object instanceof Circle) {
      const diameter = Math.max(1, Math.min(layer.width, layer.height))
      object.set({
        radius: diameter / 2,
        scaleX: layer.width / diameter,
        scaleY: layer.height / diameter,
      })
    } else if (object instanceof Rect) {
      const radius = layer.shapeType === 'rounded-rect' ? (layer.borderRadius ?? 8) : 0
      object.set({
        width: Math.max(1, layer.width),
        height: Math.max(1, layer.height),
        scaleX: 1,
        scaleY: 1,
        rx: radius,
        ry: radius,
      })
    }
  } else if (layer.type === 'icon' && object instanceof Path) {
    object.set({
      fill: null,
      stroke: layer.color,
      // L'épaisseur se lit dans le repère de 24 de l'icône : 2 rend le trait
      // de Lucide, quelle que soit la taille du calque.
      strokeWidth: layer.strokeWidth ?? ICON_STROKE,
      shadow: createShadow(layer.shadow),
      scaleX: layer.width / Math.max(1, object.width),
      scaleY: layer.height / Math.max(1, object.height),
    })
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
      shadow:
        !officialBezel && layer.shadowEnabled
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
  placeAtSceneCenter(object, layer.x + screenOffset + size.width / 2, layer.y + size.height / 2)

  object.setCoords()
}

/**
 * Pose un objet en un point de la scène, qu'il soit ou non pris dans une
 * sélection multiple.
 *
 * `left`/`top` se lisent dans le repère du parent : dès qu'un objet appartient à
 * une `ActiveSelection`, y écrire une coordonnée de scène le décale du centre de
 * la sélection. Mesuré : sélectionner au lasso trois calques d'une planche qui
 * n'était pas la planche courante change la planche courante, donc relance une
 * passe de synchronisation, qui reposait ces trois calques 1182px plus loin —
 * hors de leur écrêtage, donc invisibles, sans que rien n'ait été déplacé. La
 * position fautive devenait vraie au premier `object:modified` suivant, qui lit
 * la matrice. Le nudge au clavier sur une sélection multiple passait par le même
 * chemin, en boucle.
 *
 * `setXY` fait la conversion vers le repère du parent. La branche est gardée
 * pour laisser intact le chemin courant, où l'objet est fils du canevas.
 */
function placeAtSceneCenter(object: RenderedObject, x: number, y: number): void {
  if (object.group) object.setXY(new Point(x, y), 'center', 'center')
  else object.set({ left: x, top: y })
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
