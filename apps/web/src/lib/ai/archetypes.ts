import { type BoardSize } from '@/lib/canvas/canvas-utils'
import { APP_STORE_PROFILE } from '@/lib/dimensions'
import { wrappedLineCount, type TextMeasure } from '@/lib/locale'
import { mix, readableInk, shade, type Palette } from '@/lib/ai/palette'
import type { Background } from '@/types'
import type { ShapeId } from '@/lib/vector-catalog'

/**
 * Six compositions, et la règle qui décide laquelle porte quel rang.
 *
 * Ce qui existait : **une** composition, appliquée aux dix planches — accroche
 * en haut, appareil centré, aplat quasi-blanc. Dix fois la même image, dans la
 * fonction dont le produit tout entier promet qu'elle compose une fiche App
 * Store. L'utilisateur l'a dit sans détour, et il avait raison : ça n'utilisait
 * rien de ce que ScreenForge sait faire.
 *
 * Le modèle de référence est celui de Shotluma, et il est repris **à l'envers**.
 * Là-bas, les archétypes sont de la prose dans un prompt, un modèle choisit des
 * coordonnées libres, puis une boucle mesure le DOM rendu et lui renvoie ses
 * défauts à réparer. Ici la doctrine est inverse et ne bouge pas : le modèle
 * écrit les mots, le dépôt écrit les calques. Alors la table d'archétypes
 * devient une table — des fractions de planche, pas des phrases — et les règles
 * de qualité que là-bas un modèle relit dans une image deviennent des
 * assertions qui échouent au test :
 *
 * — deux planches voisines ne portent jamais le même archétype ;
 * — un lot de trois planches ou plus en porte au moins trois différents ;
 * — aucune bande vide d'un quart de planche (« FILL THE FRAME ») ;
 * — un appareil choisi automatiquement garde au moins 90 % de sa surface dans le cadre ;
 * — l'accroche tient 4,5:1 sur son fond, dégradé compris.
 *
 * Ce que l'adaptation refuse de copier : Shotluma dispose de rendus d'iPhone en
 * perspective, larges (rapport 1,11), qu'un cadrage à 130 % de la largeur peut
 * faire déborder sans les décapiter. ScreenForge n'a que des cadres droits, en
 * rapport 0,46 : la même consigne y produirait un appareil de 2,8 fois la
 * hauteur de la planche. La démesure y est donc obtenue autrement — un appareil
 * large, ancré haut, coupé par le bas — et les plages sont recalculées, pas
 * recopiées.
 *
 * Ce qui a été écarté, et pourquoi : l'archétype DUO (deux appareils inclinés en
 * sens contraires) demanderait une seconde capture par planche, donc un second
 * index dans `PlannedScreen` ; cinq archétypes suffisent déjà à tenir les deux
 * règles d'assignation, et un « duo » dont le deuxième appareil est vide se lit
 * comme une panne. La mise en exergue d'un mot dans l'accent, elle, attend que
 * `add_text` sache porter les styles de passage que l'éditeur sait déjà tenir.
 */

/** La planche, en unités de projet. Tout le reste en est une fraction. */
const APPLE_BOARD = APP_STORE_PROFILE.board

/** Marge latérale du texte : 7,3 % de part et d'autre, comme l'ancienne mise. */
const APPLE_GUTTER = 32

/**
 * L'interligne d'un calque de texte, tel que `layer-factories` le pose.
 *
 * Répété ici parce que la hauteur des boîtes d'accroche en est **dérivée** :
 * `locale.ts` mesure un texte en `lignes × corps × interligne`, donc une boîte
 * déclarée en fraction de planche et un corps déclaré à côté finissent par ne
 * plus s'accorder — mesuré, une boîte de 143 px annoncée pour un corps de 50
 * tenait deux lignes, et la troisième débordait. La revue des langues le
 * signalait, sur la langue d'origine, avant toute traduction.
 */
const LINE_HEIGHT = 1.2

export type ArchetypeId =
  'plein-cadre' | 'bord-coupe' | 'carte' | 'bas-ancre' | 'texte-sur-appareil' | 'mur'

export interface PlanBox {
  x: number
  y: number
  width: number
  height: number
}

export interface PlanText extends PlanBox {
  text: string
  color: string
  fontSize: number
  fontWeight: number
  align: 'left' | 'center' | 'right'
}

export interface PlanAccent extends PlanBox {
  shape: ShapeId
  color: string
  opacity: number
  rotation: number
}

export interface PlanDevice extends PlanBox {
  rotation: number
}

/**
 * Une composition résolue : des nombres, plus aucune fraction.
 *
 * `accentsBehind` et `accentsFront` sont deux listes et non une, parce que
 * l'ordre de peinture est l'information : une forme derrière l'appareil lui
 * donne de la profondeur, la même devant lui sert de pastille de lisibilité
 * sous une accroche qui le chevauche. Un seul tableau aurait forcé les deux
 * lecteurs à retrouver la frontière, chacun de son côté.
 */
export interface ArchetypeLayout {
  headline: PlanText
  /** Absent sur la planche de clôture, qui n'en porte pas. */
  device?: PlanDevice
  accentsBehind: PlanAccent[]
  accentsFront: PlanAccent[]
}

/**
 * Estimation prudente d'Inter Bold pour valider avant que le calque existe.
 * Les glyphes larges sont volontairement surestimés : refuser un cas limite
 * vaut mieux que laisser une quatrième ligne descendre sur l'appareil.
 */
const measureHeadline: TextMeasure = (text, layer) => {
  const em = [...text].reduce((width, character) => {
    const base = character.normalize('NFD')[0] ?? character
    if (/\s/.test(base)) return width + 0.32
    if (/[MW@%&mw]/.test(base)) return width + 0.96
    if (/[ilIjtfr1.,;:'’!|]/.test(base)) return width + 0.34
    if (/[A-Z]/.test(base)) return width + 0.74
    return width + 0.62
  }, 0)
  return em * layer.fontSize + Math.max(0, text.length - 1) * layer.letterSpacing
}

export function headlineLineCount(headline: PlanText): number {
  return wrappedLineCount(
    headline.text,
    {
      width: headline.width,
      fontSize: headline.fontSize,
      fontWeight: headline.fontWeight,
      letterSpacing: 0,
    },
    'Inter',
    measureHeadline,
  )
}

/** Ce dont une composition a besoin, et rien du plan qui ne la regarde pas. */
export interface ArchetypeContext {
  palette: Palette
  /**
   * Le fond effectivement porté par la planche, donné et non redérivé.
   *
   * C'est ce qui garde une seule origine à la couleur : `backgroundFor` la
   * décide une fois, le plan la porte, et la composition s'y adapte — l'encre
   * est choisie contre ce fond-là. Redériver ici ferait deux sources qui
   * divergeraient le jour où un fournisseur distant proposerait un fond.
   */
  background: Background
  headline: string
  /** largeur / hauteur du cadre d'appareil choisi. */
  deviceAspect: number
  /** Le rang de la planche : il décide du sens des inclinaisons. */
  index: number
  board?: BoardSize
}

/**
 * Le fond, en quatre recettes.
 *
 * « Be confident - a saturated brand color or a rich dark tone as a full-bleed
 * background almost always beats a timid neutral. » La consigne est de Shotluma
 * et elle est appliquée telle quelle : aucune des quatre ne rend l'aplat nu de
 * la palette, et la planche de clôture prend l'accent plein cadre.
 */
type BackgroundRecipe =
  /** Un dégradé sourd dans la couleur de la palette : le fond par défaut. */
  | { kind: 'voile'; angle: number }
  /** Une lueur d'accent partant d'un point : de la profondeur sans motif. */
  | { kind: 'halo'; centerX: number; centerY: number }
  /** L'accent plein cadre. Réservé à la planche qui n'a que des mots. */
  | { kind: 'accent' }

function resolveBackground(recipe: BackgroundRecipe, palette: Palette): Background {
  if (recipe.kind === 'accent') return { type: 'solid', color: palette.accent }
  if (recipe.kind === 'halo') {
    return {
      type: 'radial-gradient',
      centerX: recipe.centerX,
      centerY: recipe.centerY,
      stops: [
        { offset: 0, color: haloTint(palette, 0.22) },
        { offset: 1, color: shade(palette.background, -0.08) },
      ],
    }
  }
  return {
    type: 'linear-gradient',
    angle: recipe.angle,
    stops: [
      { offset: 0, color: shade(palette.background, 0.04) },
      { offset: 1, color: shade(palette.background, -0.16) },
    ],
  }
}

/**
 * Le fond, teinté vers l'accent sans jamais y être remplacé.
 *
 * L'accent est d'abord ramené du côté du fond — assombri sur un thème clair,
 * éclairci sur un thème sombre — avant d'y être mêlé. Mêler l'accent brut
 * produisait une lueur plus contrastée que l'accroche elle-même, qui prenait
 * l'œil au lieu de porter l'appareil.
 */
function haloTint(palette: Palette, amount: number): string {
  const lift = shade(palette.accent, palette.ink === '#ffffff' ? -0.2 : 0.3)
  return mix(palette.background, lift, amount)
}

/** Toutes les couleurs qu'un fond peut poser sous une accroche. */
function backgroundColors(background: Background): string[] {
  return background.type === 'solid'
    ? [background.color]
    : background.stops.map((stop) => stop.color)
}

interface Spec {
  id: ArchetypeId
  /** Ce que l'archétype fait, en une ligne : lu dans la revue. */
  label: string
  background: BackgroundRecipe
  /** Fraction de la largeur de planche. Absent = planche sans appareil. */
  deviceWidth?: number
  /** Fractions de planche pour le coin haut-gauche de l'appareil. */
  deviceX?: number
  deviceY?: number
  /** Inclinaison de base, en degrés. Le rang en décide le sens. */
  deviceTilt?: number
  headline: {
    y: number
    /** Combien de lignes la boîte doit tenir. La hauteur en découle. */
    lines: number
    fontSize: number
    fontWeight: number
    align: 'left' | 'center' | 'right'
    /** Fraction de la largeur, marges comprises. */
    width?: number
    /** L'accroche passe devant l'appareil, avec sa pastille. */
    overDevice?: boolean
  }
}

/**
 * La table, dans l'ordre où l'assignation les rencontre.
 *
 * Les plages de Shotluma sont ramenées à une valeur : là-bas un modèle choisit
 * dans un intervalle et une boucle corrige ses excès, ici personne ne choisit,
 * donc l'intervalle n'a aucun lecteur. Ce qui varie d'une planche à l'autre est
 * l'archétype lui-même et le sens de son inclinaison — assez pour qu'un lot ne
 * se lise pas comme une série, pas assez pour qu'il cesse d'être un lot.
 */
const SPECS: readonly Spec[] = [
  {
    id: 'plein-cadre',
    label: 'Appareil centré, entièrement visible',
    background: { kind: 'voile', angle: 165 },
    deviceWidth: 0.6,
    deviceX: 0.2,
    deviceY: 0.31,
    deviceTilt: 0,
    headline: { y: 0.11, lines: 3, fontSize: 44, fontWeight: 700, align: 'center' },
  },
  {
    id: 'bord-coupe',
    label: 'Appareil décalé, entièrement visible',
    background: { kind: 'halo', centerX: 22, centerY: 68 },
    deviceWidth: 0.59,
    deviceX: 0.08,
    deviceY: 0.32,
    deviceTilt: 2,
    headline: { y: 0.11, lines: 3, fontSize: 42, fontWeight: 700, align: 'left' },
  },
  {
    id: 'carte',
    label: 'Appareil posé, accroche au-dessus',
    background: { kind: 'voile', angle: 200 },
    deviceWidth: 0.59,
    deviceX: 0.205,
    deviceY: 0.31,
    deviceTilt: 0,
    headline: { y: 0.11, lines: 3, fontSize: 42, fontWeight: 700, align: 'center' },
  },
  {
    id: 'bas-ancre',
    label: 'Appareil coupé par le haut, accroche en bas',
    background: { kind: 'voile', angle: 20 },
    deviceWidth: 0.8,
    deviceX: 0.1,
    deviceY: -0.2,
    deviceTilt: 0,
    headline: { y: 0.66, lines: 3, fontSize: 50, fontWeight: 700, align: 'center' },
  },
  {
    id: 'texte-sur-appareil',
    label: 'Accroche posée sur l’appareil',
    background: { kind: 'halo', centerX: 78, centerY: 26 },
    deviceWidth: 0.82,
    deviceX: 0.09,
    deviceY: 0.16,
    deviceTilt: 4,
    headline: {
      y: 0.05,
      lines: 3,
      fontSize: 52,
      fontWeight: 800,
      align: 'center',
      overDevice: true,
    },
  },
  {
    id: 'mur',
    label: 'Sans appareil : les mots seuls, plein cadre',
    background: { kind: 'accent' },
    headline: {
      y: 0.3,
      /* Quatre : c'est la planche qui n'a que des mots. */
      lines: 4,
      fontSize: 64,
      fontWeight: 800,
      align: 'left',
      width: 0.82,
    },
  },
]

export function archetypeSpec(id: ArchetypeId): Spec {
  return SPECS.find((spec) => spec.id === id) ?? SPECS[0]
}

export const ARCHETYPE_IDS: readonly ArchetypeId[] = SPECS.map((spec) => spec.id)

export function isArchetypeId(value: unknown): value is ArchetypeId {
  return ARCHETYPE_IDS.some((id) => id === value)
}

/**
 * Qui porte quel rang.
 *
 * Trois faits de Shotluma, transcrits : la première planche prend un archétype
 * marquant (c'est la seule que la plupart des gens verront), la dernière d'un
 * lot un peu long ne porte pas d'appareil (le « feature wall »), et la
 * composition sûre ne revient pas plus de deux fois. Le reste tourne sur un
 * cycle de quatre, ce qui suffit à garantir mécaniquement les deux règles :
 * jamais deux voisines identiques, et au moins trois archétypes distincts dès
 * trois planches. Un cycle plutôt qu'un tirage : deux lots identiques doivent
 * rendre la même chose, ou la revue ne prouve rien de ce que « Ajouter » posera.
 */
export const SAFE_ARCHETYPE_IDS: readonly ArchetypeId[] = ['plein-cadre', 'carte', 'bord-coupe']

export function automaticArchetype(
  index: number,
  count: number,
  hasScreenshot: boolean,
): ArchetypeId {
  if (!hasScreenshot && count > 1 && index === count - 1) return 'mur'
  return SAFE_ARCHETYPE_IDS[index % SAFE_ARCHETYPE_IDS.length]
}

export function assignArchetypes(count: number): ArchetypeId[] {
  return Array.from({ length: Math.max(0, count) }, (_unused, index) =>
    automaticArchetype(index, count, true),
  )
}

/** Le sens de l'inclinaison alterne, plutôt que de répéter le même angle. */
function tiltAt(base: number, index: number): number {
  return index % 2 === 0 ? base : -base
}

function round(value: number): number {
  return Math.round(value)
}

/**
 * Résout une composition en nombres.
 *
 * L'encre est choisie contre le fond effectivement peint, et non reprise de la
 * palette : la planche de clôture porte l'accent plein cadre, sur lequel l'encre
 * de la palette peut tomber à 2:1. Une accroche illisible sur la seule image qui
 * décide d'un téléchargement n'est pas un détail de contraste.
 */
export function composeArchetype(id: ArchetypeId, context: ArchetypeContext): ArchetypeLayout {
  const spec = archetypeSpec(id)
  const { palette, background, deviceAspect, index } = context
  const board = context.board ?? APPLE_BOARD
  const gutter = round((APPLE_GUTTER / APPLE_BOARD.width) * board.width)
  const ink = readableInk(backgroundColors(background), palette.ink)

  const headlineWidth = round((spec.headline.width ?? 1) * board.width) - gutter * 2
  const headline: PlanText = {
    text: context.headline,
    color: ink,
    fontSize: spec.headline.fontSize,
    fontWeight: spec.headline.fontWeight,
    align: spec.headline.align,
    x: gutter,
    y: round(spec.headline.y * board.height),
    width: headlineWidth,
    /* Dérivée, jamais déclarée : c'est exactement ce que `measuredHeight` rend
       pour ce nombre de lignes, donc une accroche qui tient dans le compte tient
       dans la boîte, sans marge à croire. */
    height: round(spec.headline.lines * spec.headline.fontSize * LINE_HEIGHT),
  }

  const accentsBehind: PlanAccent[] = []
  const accentsFront: PlanAccent[] = []

  let device: PlanDevice | undefined
  if (spec.deviceWidth !== undefined) {
    const width = round(spec.deviceWidth * board.width)
    device = {
      x: round((spec.deviceX ?? 0) * board.width),
      y: round((spec.deviceY ?? 0) * board.height),
      width,
      height: round(width / deviceAspect),
      rotation: tiltAt(spec.deviceTilt ?? 0, index),
    }
  }

  /* Une forme derrière l'appareil donne la profondeur que Shotluma obtient
     avec ses rendus en perspective — « a large blob, arch, or wave running
     behind a device and off the canvas edge adds depth cheaply ». Elle est
     posée sur les compositions qui laisseraient sinon une bande de fond nu. */
  if (id === 'carte' && device) {
    accentsBehind.push({
      shape: 'ring',
      color: palette.accent,
      opacity: 0.28,
      rotation: tiltAt(12, index),
      x: round(board.width * 0.02),
      y: round(board.height * 0.26),
      width: round(board.width * 0.96),
      height: round(board.width * 0.96),
    })
  }
  if (id === 'bord-coupe' && device) {
    accentsBehind.push({
      shape: 'blob',
      color: palette.accent,
      opacity: 0.22,
      rotation: tiltAt(18, index),
      x: round(board.width * 0.34),
      y: round(board.height * 0.5),
      width: round(board.width * 0.72),
      height: round(board.width * 0.72),
    })
  }
  if (id === 'bas-ancre') {
    accentsBehind.push({
      shape: 'line',
      color: palette.accent,
      opacity: 1,
      rotation: 0,
      x: gutter,
      y: round(board.height * 0.6),
      width: round(board.width * 0.2),
      height: 40,
    })
  }
  if (id === 'mur') {
    /* Sur l'accent plein cadre, l'accent lui-même serait invisible : les formes
       reprennent l'encre, en filigrane. */
    accentsBehind.push(
      {
        shape: 'arch',
        color: ink,
        opacity: 0.12,
        rotation: tiltAt(8, index),
        x: round(board.width * 0.42),
        y: round(board.height * 0.02),
        width: round(board.width * 0.66),
        height: round(board.width * 0.66),
      },
      {
        shape: 'spark',
        color: ink,
        opacity: 0.16,
        rotation: tiltAt(14, index),
        x: round(board.width * 0.06),
        y: round(board.height * 0.74),
        width: round(board.width * 0.3),
        height: round(board.width * 0.3),
      },
    )
  }

  /* La pastille est ce qui rend le chevauchement sûr sans mesurer le rendu.
     Shotluma pose le texte par-dessus la capture et demande au modèle de
     vérifier la lisibilité dans l'image ; ici personne ne regarde l'image, donc
     le fond de l'accroche est peint, et le contraste est acquis par
     construction plutôt que constaté après coup. */
  if (spec.headline.overDevice) {
    accentsFront.push({
      shape: 'rounded-rect',
      color: background.type === 'solid' ? background.color : background.stops[0].color,
      opacity: 0.92,
      rotation: 0,
      x: headline.x - 16,
      y: headline.y - 16,
      width: headline.width + 32,
      height: headline.height + 32,
    })
  }

  return { headline, device, accentsBehind, accentsFront }
}

/** Le fond que porte la planche de ce rang. La seule origine de la couleur. */
export function backgroundFor(id: ArchetypeId, palette: Palette): Background {
  return resolveBackground(archetypeSpec(id).background, palette)
}

/** La part de l'appareil qui reste dans le cadre. Le défaut ScreenForge exige 90 %. */
export function onBoardRatio(device: PlanBox, board: BoardSize = APPLE_BOARD): number {
  const visibleWidth = Math.max(
    0,
    Math.min(device.x + device.width, board.width) - Math.max(device.x, 0),
  )
  const visibleHeight = Math.max(
    0,
    Math.min(device.y + device.height, board.height) - Math.max(device.y, 0),
  )
  return (visibleWidth * visibleHeight) / (device.width * device.height)
}

/**
 * La plus haute bande de planche que rien n'occupe.
 *
 * « If more than about a quarter of the canvas ends up as one uninterrupted
 * stretch of empty background, treat it as a defect. » La règle est de
 * Shotluma, où un modèle la juge sur une image rendue ; ici elle se calcule sur
 * les boîtes, ce qui la rend opposable au test plutôt qu'à l'œil.
 */
export function tallestEmptyBand(layout: ArchetypeLayout, board: BoardSize = APPLE_BOARD): number {
  return tallestEmptyBandOf(
    [
      layout.headline,
      ...(layout.device ? [layout.device] : []),
      ...layout.accentsBehind,
      ...layout.accentsFront,
    ],
    board,
  )
}

/**
 * La même règle, sur des boîtes quelconques.
 *
 * Le générateur connaît la forme de ses propres plans ; une planche que
 * quelqu'un d'autre a composée n'a ni « accents derrière » ni « accents
 * devant », seulement des calques. La règle, elle, est la même des deux côtés —
 * c'est ce qui permet à `board-review` d'exiger d'un agent ce que le dépôt
 * s'impose à lui-même, sans en réécrire une seconde version qui divergerait.
 */
export function tallestEmptyBandOf(
  boxes: readonly PlanBox[],
  board: BoardSize = APPLE_BOARD,
): number {
  const covered = boxes
    .map((box) => [Math.max(0, box.y), Math.min(board.height, box.y + box.height)] as const)
    .filter(([top, bottom]) => bottom > top)
    .sort((left, right) => left[0] - right[0])

  let widest = 0
  let cursor = 0
  for (const [top, bottom] of covered) {
    if (top > cursor) widest = Math.max(widest, top - cursor)
    cursor = Math.max(cursor, bottom)
  }
  return Math.max(widest, board.height - cursor)
}

export const PLAN_BOARD = APPLE_BOARD
