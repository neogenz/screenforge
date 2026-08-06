/*
 * Scénario de la mini-app du hero : le geste fondateur du produit, en boucle.
 * Les cibles du curseur sont des noms enregistrés par le mock lui-même
 * (`data-cursor-target`) — la chorégraphie survit aux changements de layout.
 */
export type CursorTarget =
  'stage' | 'device-btn' | 'text-btn' | 'apply-btn' | 'export-btn' | 'text-layer' | 'bg-swatches'

export type DemoLayerId = 'device' | 'text'

export interface DemoSceneState {
  device: boolean
  textChars: number
  bgIndex: number
  tiles: number
  exportState: 'idle' | 'running' | 'done'
  selected: DemoLayerId | null
  /* Positions en % de l'artboard (centre du calque). */
  textPos: { x: number; y: number }
  devicePos: { x: number; y: number }
}

export const EMPTY_SCENE: DemoSceneState = {
  device: false,
  textChars: 0,
  bgIndex: 0,
  tiles: 0,
  exportState: 'idle',
  selected: null,
  textPos: { x: 50, y: 46 },
  devicePos: { x: 50, y: 68 },
}

/* L'état figé servi aux utilisateurs en reduced-motion : la composition
   finale, sans la performance. */
export const FINAL_SCENE: DemoSceneState = {
  ...EMPTY_SCENE,
  device: true,
  textChars: Number.POSITIVE_INFINITY,
  tiles: 4,
  textPos: { x: 50, y: 14 },
}

/* Dégradés de l'artboard — les presets réels du produit (assets/gradients.ts). */
export const DEMO_GRADIENTS = [
  'linear-gradient(135deg, #ff7c29 0%, #ff3c8e 50%, #9b1dff 100%)',
  'linear-gradient(180deg, #0a2463 0%, #3e8989 100%)',
  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
]

export const CURSOR_TRAVEL_MS = 480
export const CURSOR_CLICK_MS = 260
