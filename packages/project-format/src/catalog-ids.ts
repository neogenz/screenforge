/**
 * Les identifiants fermés du format : modèles d'appareil, formes, icônes et
 * polices de contenu.
 *
 * Un projet ne persiste jamais de SVG ni de tracé — il persiste un identifiant
 * de l'une de ces listes. C'est ce qui rend sûr le jour où un modèle de
 * langage pose des calques : il choisit dans une liste fermée au lieu d'écrire
 * du balisage que personne n'a relu, et un identifiant inconnu est refusé à la
 * validation plutôt que rendu.
 *
 * Ce fichier est la seule source des listes. L'éditeur web y accroche ses
 * tracés, gabarits et aperçus (`lib/vector-catalog.ts`,
 * `assets/device-frames/index.ts`, `lib/fonts.ts`), et les schémas d'outils IA
 * (`ai-tools.ts`) en tirent leurs énumérations — deux tables auraient divergé
 * au premier ajout.
 *
 * Les formes sont tracées dans une boîte de 100 × 100, les icônes gardent la
 * boîte de 24 de leur source Lucide et se dessinent au trait.
 */

export const SHAPE_BOX = 100
export const ICON_BOX = 24
/** Épaisseur du trait d'une icône, dans son repère de 24. */
export const ICON_STROKE = 2

export type DevicePlatform = 'iphone' | 'ipad' | 'watch'

/**
 * Modèles originaux disponibles par famille de projet.
 *
 * Les identifiants iPhone historiques restent rendables. Les silhouettes
 * tablette et montre sont volontairement génériques : elles ne nomment aucun
 * produit Apple et ne persistent aucun asset sous licence.
 */
export const DEVICE_MODEL_IDS_BY_PLATFORM = {
  iphone: [
    'iphone-17-pro-max',
    'iphone-17-pro',
    'iphone-17',
    'iphone-air',
    'iphone-16-plus',
    'iphone-16',
    'iphone-16e',
    // Legacy — kept so older projects still render
    'iphone-16-pro-max',
    'iphone-16-pro',
  ],
  ipad: ['tablet-slate', 'tablet-studio'],
  watch: ['watch-halo', 'watch-compact'],
} as const

/** Catalogue plat pour le format persistant et les migrations. */
export const DEVICE_MODEL_IDS = [
  ...DEVICE_MODEL_IDS_BY_PLATFORM.iphone,
  ...DEVICE_MODEL_IDS_BY_PLATFORM.ipad,
  ...DEVICE_MODEL_IDS_BY_PLATFORM.watch,
] as const

export type DeviceModelId = (typeof DEVICE_MODEL_IDS)[number]

export function deviceModelIdsForPlatform(platform: DevicePlatform): readonly DeviceModelId[] {
  return DEVICE_MODEL_IDS_BY_PLATFORM[platform]
}

export function deviceModelPlatform(model: DeviceModelId): DevicePlatform {
  if ((DEVICE_MODEL_IDS_BY_PLATFORM.ipad as readonly string[]).includes(model)) return 'ipad'
  if ((DEVICE_MODEL_IDS_BY_PLATFORM.watch as readonly string[]).includes(model)) return 'watch'
  return 'iphone'
}

export const SHAPE_IDS = [
  'rectangle',
  'rounded-rect',
  'circle',
  'line',
  'triangle',
  'diamond',
  'arch',
  'ring',
  'star',
  'burst',
  'spark',
  'blob',
  'arrow',
  'wave',
] as const

export type ShapeId = (typeof SHAPE_IDS)[number]

export const ICON_IDS = [
  'check',
  'circle-check-big',
  'shield-check',
  'lock',
  'key',
  'star',
  'heart',
  'thumbs-up',
  'sparkles',
  'flame',
  'crown',
  'award',
  'zap',
  'trending-up',
  'chart-column',
  'activity',
  'target',
  'search',
  'settings',
  'bell',
  'camera',
  'play',
  'download',
  'send',
  'calendar',
  'clock',
  'wallet',
  'credit-card',
  'gift',
  'users',
  'map-pin',
  'globe',
  'cloud',
  'rocket',
  'lightbulb',
  'message-circle',
] as const

export type IconId = (typeof ICON_IDS)[number]

/**
 * Les polices de contenu proposées à un texte neuf, chargées à la demande par
 * l'éditeur. `CONTENT_FONTS[0]` sert de police à tout texte neuf : une
 * grotesque au dessin affirmé plutôt qu'un neutre de gabarit.
 */
export const CONTENT_FONTS = [
  'Space Grotesk',
  'Archivo',
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Lato',
  'Playfair Display',
  'Oswald',
  'Raleway',
  'Nunito',
  'Merriweather',
  'Source Sans 3',
  'PT Sans',
  'Ubuntu',
  'Rubik',
  'Work Sans',
  'Quicksand',
  'Barlow',
  'DM Sans',
  'Noto Sans',
  'Fira Sans',
  'Mulish',
  'Josefin Sans',
  'Inconsolata',
  'Karla',
  'Cabin',
  'Libre Baskerville',
  'EB Garamond',
  'Crimson Text',
  'Cormorant Garamond',
  'Zilla Slab',
  'Rokkitt',
  'Arvo',
  'Bitter',
  'Exo 2',
  'Titillium Web',
  'Anton',
  'Bebas Neue',
  'Righteous',
  'Pacifico',
  'Dancing Script',
  'Lobster',
  'Caveat',
  'Sacramento',
  'Great Vibes',
  'Satisfy',
  'Comfortaa',
  'Fredoka One',
  'Varela Round',
] as const

const SHAPE_ID_SET: ReadonlySet<string> = new Set(SHAPE_IDS)
const ICON_ID_SET: ReadonlySet<string> = new Set(ICON_IDS)

export function isShapeId(id: unknown): id is ShapeId {
  return typeof id === 'string' && SHAPE_ID_SET.has(id)
}

export function isIconId(id: unknown): id is IconId {
  return typeof id === 'string' && ICON_ID_SET.has(id)
}
