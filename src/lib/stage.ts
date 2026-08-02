/**
 * Floating-chrome layout constants — single source of truth.
 *
 * The canvas is full-bleed; the top bar, drawers and filmstrip float above
 * it. `stageInsets` computes the clear rectangle the fit logic must target
 * so artboards never hide behind the chrome.
 */

export const ISLAND_MARGIN = 12
export const TOP_BAR_HEIGHT = 48
export const DRAWER_WIDTH_LAYERS = 280
export const DRAWER_WIDTH_PROPS = 320

/**
 * Hauteur de vignette dans la filmstrip. Au ratio 1320×2868 elle donne ~39px
 * de large : en deçà on ne distingue plus une mise en page d'une autre, ce qui
 * est le seul service que rend la bande.
 */
export const THUMBNAIL_HEIGHT = 100
/** Vignette + son libellé (20px) + l'écart (6px) + le rembourrage de l'îlot (2×10). */
export const FILMSTRIP_HEIGHT = THUMBNAIL_HEIGHT + 20 + 6 + 20

/** Top bar (48px) + margins above and below. */
export const STAGE_TOP_INSET = TOP_BAR_HEIGHT + ISLAND_MARGIN * 2
/** Filmstrip + margins. */
export const STAGE_BOTTOM_INSET = FILMSTRIP_HEIGHT + ISLAND_MARGIN * 2

export interface StageInsets {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Rectangle libre visé par l'ajustement. Les drawers restent superposés au
 * stage — ils ne repoussent jamais le canvas — mais un drawer ouvert masque
 * bel et bien sa bande : l'ignorer à l'ajustement posait la première et la
 * dernière planche à moitié sous un panneau, ce que rien ne rattrape ensuite.
 */
export function stageInsets(
  open: { layers?: boolean; props?: boolean } = {},
): StageInsets {
  return {
    left: ISLAND_MARGIN * 2 + (open.layers ? DRAWER_WIDTH_LAYERS : 0),
    right: ISLAND_MARGIN * 2 + (open.props ? DRAWER_WIDTH_PROPS : 0),
    top: STAGE_TOP_INSET,
    bottom: STAGE_BOTTOM_INSET,
  }
}
