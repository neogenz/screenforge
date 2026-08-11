import type { IconId, ShapeId } from '@/lib/vector-catalog'

// ─── Layer Types ────────────────────────────────────────────────────────────

export type LayerType = 'text' | 'device-frame' | 'image' | 'shape' | 'icon'

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

/** Ce que le projet retient d'un style de caractère : sa couleur, rien d'autre. */
export interface TextCharStyle {
  fill: string
}

/**
 * Ligne (non repliée) → colonne → style, tel que Fabric indexe un `Textbox`.
 * Les clés sont numériques, écrites en chaîne. Voir `lib/text-styles.ts`.
 */
export type TextCharStyles = Record<string, Record<string, TextCharStyle>>

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
  /**
   * Couleurs posées sur un passage plutôt que sur le calque. Absent tant que
   * personne n'en a peint : la couleur du calque suffit à presque tout.
   * Voir `lib/text-styles.ts` pour ce que les index veulent dire.
   */
  charStyles?: TextCharStyles
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

export type ScreenshotFitMode = 'cover' | 'contain' | 'fill'

export interface ScreenshotSize {
  width: number
  height: number
}

/**
 * Comment la capture se pose dans l'ouverture — voir lib/screenshot-placement.
 * Absent vaut `cover` centré au zoom 1, soit le rendu de toutes les versions
 * précédentes.
 */
export interface ScreenshotPlacement {
  mode: ScreenshotFitMode
  /** Point focal, 0–1 dans le repère de l'ouverture. */
  focusX: number
  focusY: number
  zoom: number
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
  /** Taille naturelle de la capture, mesurée à l'import. Sans elle, pas de cadrage. */
  screenshotSize?: ScreenshotSize
  /** Cadrage de la capture dans la dalle ; survit au remplacement de l'asset. */
  placement?: ScreenshotPlacement
  /**
   * Le rôle de cet écran dans la campagne — `onboarding`, `budget`, `reglages`.
   *
   * C'est ce qui rend une release remplaçable : sans lui, dix captures et dix
   * appareils n'ont aucun appariement, et la seule façon de savoir laquelle va
   * où est de les reconnaître à l'œil. Un même slot peut viser plusieurs
   * appareils — la même capture apparaît souvent sur deux planches.
   */
  slot?: string
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
  shapeType: ShapeId
  fill: string | GradientFill
  stroke?: string
  strokeWidth?: number
  borderRadius?: number // rounded-rect only
  shadow?: TextShadow
}

/**
 * Une icône du catalogue, jamais un SVG.
 *
 * Le calque porte un identifiant que `lib/vector-catalog.ts` sait résoudre : le
 * tracé n'entre pas dans le fichier de projet, donc rien de ce qu'un modèle de
 * langage propose ne peut devenir du balisage rendu tel quel.
 */
export interface IconLayer extends BaseLayer {
  type: 'icon'
  iconId: IconId
  color: string
  /** Épaisseur du trait dans le repère de 24 de l'icône. */
  strokeWidth?: number
  shadow?: TextShadow
}

export type Layer = TextLayer | DeviceFrameLayer | ImageLayer | ShapeLayer | IconLayer

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
  /** Les lots figés, du plus ancien au plus récent. Voir `lib/release.ts`. */
  releases?: Release[]
  /** Les variantes de langue. Voir `lib/locale.ts`. */
  locales?: LocaleVariant[]
}

// ─── Localisation ────────────────────────────────────────────────────────────

/**
 * Le script d'écriture, pas la langue.
 *
 * C'est lui qui décide de la police : le japonais et le chinois simplifié
 * partagent des idéogrammes mais pas une fonte, et le portugais du Brésil
 * n'impose rien de plus que le portugais. Une liste fermée, parce qu'à chaque
 * entrée correspond une famille de polices vérifiée.
 */
export type ScriptId =
  | 'latin'
  | 'cyrillic'
  | 'greek'
  | 'japanese'
  | 'korean'
  | 'simplified-chinese'
  | 'arabic'
  | 'hebrew'
  | 'devanagari'
  | 'thai'

export interface LocaleText {
  value: string
  /**
   * Faux tant qu'un humain ne l'a pas relu. Une traduction automatique arrive
   * toujours à faux : la promettre parfaite serait mentir, et c'est le seul
   * champ qui distingue « proposé » de « validé ».
   */
  reviewed: boolean
}

/**
 * Une langue de plus, sans un projet de plus.
 *
 * La variante ne duplique ni écran ni calque : elle ne porte que les textes,
 * indexés par l'identifiant du calque qu'ils remplacent. Les identifiants, la
 * structure, les cadrages et les rôles restent donc ceux du projet — une
 * correction de mise en page profite à toutes les langues, et rien ne peut
 * diverger sans que quelqu'un l'ait voulu.
 */
export interface LocaleVariant {
  /** BCP-47 court : `ja`, `pt-BR`. C'est la clé, et le nom du dossier d'export. */
  code: string
  name: string
  script: ScriptId
  /** Police imposée aux textes de cette langue, quand le script l'exige. */
  fontFamily?: string
  /** `layerId` → variante. Un calque absent garde le texte du projet. */
  texts: Record<string, LocaleText>
}

/**
 * Ce qu'une release fige : tout ce qui se rend, et rien d'autre.
 *
 * Ni `id`, ni horodatage, ni écran actif — ce sont des faits sur le projet
 * vivant, pas sur le lot livré. Deux figements du même contenu doivent donner
 * le même instantané, sans quoi le diff structurel signalerait un changement
 * là où l'utilisateur n'a fait qu'attendre.
 */
export interface ProjectSnapshot {
  name: string
  screens: Screen[]
  layoutLayers: Layer[]
  globals: GlobalSettings
}

export interface ReleaseFile {
  /** `6.9/01_onboarding.png` — la place du fichier dans le lot. */
  path: string
  screenId: string
  width: number
  height: number
  byteLength: number
  sha256: string
}

/**
 * Un lot livré, immuable.
 *
 * Elle porte les empreintes de ses PNG et l'instantané qui les a produits, pas
 * les pixels : le rendu est déterministe, donc l'instantané suffit à les
 * régénérer, et vérifier une release consiste à la rejouer puis à comparer les
 * empreintes. Stocker dix PNG par release aurait pesé des dizaines de mégaoctets
 * dans IndexedDB pour une information que le projet contient déjà.
 */
export interface Release {
  id: string
  name: string
  createdAt: number
  /** Le palier au moment du figement : un filigrane change les empreintes. */
  watermarked: boolean
  /**
   * La langue effectivement rendue, absente pour la langue d'origine.
   *
   * Sans elle, publier consiste à choisir une localisation de destination sans
   * rien qui dise ce que les planches contiennent — et téléverser un lot
   * français dans la fiche allemande passe sans une erreur. Le code est celui du
   * projet (`de`), pas celui d'App Store Connect (`de-DE`) : la correspondance
   * est proposée au moment de publier, jamais figée ici.
   */
  locale?: string
  files: ReleaseFile[]
  snapshot: ProjectSnapshot
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
