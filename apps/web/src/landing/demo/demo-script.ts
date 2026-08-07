/*
 * Scénario de la mini-app du hero : le geste fondateur du produit, en boucle.
 * Les cibles du curseur sont des noms enregistrés par le mock lui-même
 * (`data-cursor-target`) — la chorégraphie survit aux changements de layout.
 */
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'

/* Les pastilles de fond partagaient une seule cible, la rangée entière : le
   curseur se posait à son centre et n'en bougeait plus pendant que trois
   dégradés différents s'allumaient. Il visait la rangée, pas le bouton. */
export type CursorTarget =
  | 'stage'
  | 'device-btn'
  | 'text-btn'
  | 'apply-btn'
  | 'export-btn'
  | 'text-layer'
  | `bg-swatch-${number}`
  | `frame-color-${number}`
  | `text-size-${number}`
  | `text-color-${number}`
  | `layer-row-${DemoLayerId}`

export type DemoLayerId = 'device' | 'text'

export interface DemoSceneState {
  device: boolean
  textChars: number
  bgIndex: number
  tiles: number
  exportState: 'idle' | 'running' | 'done'
  selected: DemoLayerId | null
  /* Calques masqués depuis la liste, comme dans l'app. */
  hidden: DemoLayerId[]
  textSize: number
  textColor: number
  frameColor: number
  /* Positions en % de la planche (centre du calque), pour la planche courante.
     `GlobalSettings` du produit couvre la police, la couleur, le fond et le
     modèle de téléphone — pas la position : un calque est posé sur son écran.
     Les voisines gardent donc les leurs, figées au moment où « Tous les
     écrans » a diffusé la composition. Sans cette séparation, tirer le titre
     sur la planche du milieu tirait les trois, ce qu'aucun éditeur ne fait. */
  textPos: { x: number; y: number }
  devicePos: { x: number; y: number }
  spreadTextPos: { x: number; y: number }
  spreadDevicePos: { x: number; y: number }
}

/* Le filmstrip du mock porte autant de vignettes qu'un projet a d'écrans.
   Il en montrait quatre pendant que le titre, le bandeau et la FAQ en
   promettaient dix : la démo démentait le chiffre qu'elle devait prouver. */
export const DEMO_TILES = MAX_PROJECT_SCREENS

/* Hauteur du cadre, en % de l'artboard, et le cadre déborde par le bas.
   66 avec un centre à 82 % : le téléphone couvre de 49 % à 115 %, donc ses
   quinze derniers pour cent sont coupés par le bord de la planche. C'est la
   convention la plus reconnaissable des planches App Store publiées, et à
   50 % centrés sur 74 % le téléphone flottait au milieu d'une marge basse que
   personne ne laisse. Il y gagne aussi un tiers de surface, donc une maquette
   d'app lisible plutôt qu'une vignette. Le couple (hauteur, position) est
   déclaré ici parce que la scène initiale du texte en dépend : le texte se
   tape au-dessus du cadre, jamais dessus. */
export const DEVICE_HEIGHT_PCT = 66

export const EMPTY_SCENE: DemoSceneState = {
  device: false,
  textChars: 0,
  bgIndex: 0,
  tiles: 0,
  exportState: 'idle',
  selected: null,
  hidden: [],
  textSize: 1,
  textColor: 0,
  frameColor: 0,
  textPos: { x: 50, y: 34 },
  devicePos: { x: 50, y: 82 },
  spreadTextPos: { x: 50, y: 14 },
  spreadDevicePos: { x: 50, y: 82 },
}

/* L'état figé servi aux utilisateurs en reduced-motion : la composition
   finale, sans la performance. Elle inclut la couleur de cadre que la démo
   choisit en jouant : figée sur le défaut, elle montrerait une planche que la
   séquence ne produit jamais. */
export const FINAL_SCENE: DemoSceneState = {
  ...EMPTY_SCENE,
  device: true,
  textChars: Number.POSITIVE_INFINITY,
  tiles: DEMO_TILES,
  frameColor: 1,
  textPos: { x: 50, y: 14 },
}

/* Dégradés de l'artboard : les trois premiers presets réels du produit,
   recopiés à l'identique depuis assets/gradients.ts, angle compris. Un
   quatrième vert inventé traînait ici — la vitrine proposait une couleur que
   l'éditeur n'a pas. Le nom voyage avec le dégradé : c'est celui que l'éditeur
   affiche, et une pastille nommée « Arrière-plan 2 » est une pastille qui
   n'existe dans aucun produit. */
export const DEMO_GRADIENTS = [
  { name: 'Sunset', css: 'linear-gradient(135deg, #ff7c29 0%, #ff3c8e 50%, #9b1dff 100%)' },
  { name: 'Ocean', css: 'linear-gradient(180deg, #0a2463 0%, #3e8989 100%)' },
  { name: 'Emerald', css: 'linear-gradient(180deg, #50c878 0%, #1a5c35 100%)' },
]

/* Les trois couleurs de châssis de l'iPhone 17 Pro, recopiées de
   `assets/device-frames/index.ts` (`PRO_17_COLORS`), valeurs comprises.
   `colors[0]` est le neutre par défaut du produit, et la démo choisit le
   deuxième en jouant : la vitrine ne propose pas un châssis que l'éditeur
   n'a pas, et le libellé vient de copy.ts pour rester bilingue. */
export const FRAME_COLORS = ['#ffffff', '#3A4B63', '#C75B33']

/* Trois pas de corps, en `cqw` de la planche — la même unité que le titre.
   Un éditeur de captures sans réglage de taille de titre n'est pas un
   éditeur, c'est un gabarit. */
export const TEXT_SIZES = [
  { label: 'S', size: 5 },
  { label: 'M', size: 6.5 },
  { label: 'L', size: 8.5 },
]

/* Blanc, encre, sable : les trois valeurs qui tiennent sur les vingt-deux
   dégradés du produit. Ce sont des littéraux comme le reste de ce qui se pose
   sur la planche de l'utilisateur — un token de thème virerait avec elle. */
export const TEXT_COLORS = ['#ffffff', '#101014', '#ffdca8']

/* Durée de déplacement : proportionnelle à la distance, bornée. Une constante
   unique faisait mettre le même temps à un saut de 20 px et à une traversée de
   900 — le premier se lisait comme une téléportation, le second comme un
   ralenti. C'est ce que le client a décrit par « les clics ne sont pas très
   précis » : ce n'est pas la cible qui était fausse, c'est le trajet. */
export const CURSOR_MIN_MS = 190
export const CURSOR_MAX_MS = 620
export const CURSOR_MS_PER_PX = 0.62
export const CURSOR_CLICK_MS = 260

export const cursorTravelMs = (dx: number, dy: number) =>
  Math.min(CURSOR_MAX_MS, Math.max(CURSOR_MIN_MS, Math.hypot(dx, dy) * CURSOR_MS_PER_PX))

/* Le sommet de la flèche est à (1.5, 1.2) dans sa boîte de 16 : le wrapper
   était translaté sur la coordonnée brute, donc la pointe tombait en bas à
   droite de la cible pendant que le corps de la flèche la recouvrait. */
export const CURSOR_HOTSPOT = { x: 1.5, y: 1.2 }
