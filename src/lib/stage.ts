/**
 * Floating-chrome layout constants — single source of truth.
 *
 * The canvas is full-bleed; the top bar, drawers and filmstrip float above
 * it. `stageInsets` computes the clear rectangle the fit logic must target
 * so artboards never hide behind the chrome.
 */

export const ISLAND_MARGIN = 12
export const TOP_BAR_HEIGHT = 44
export const DRAWER_WIDTH_LAYERS = 264
export const DRAWER_WIDTH_PROPS = 304
export const FILMSTRIP_HEIGHT = 80

/** Top bar (44px) + margins above and below. */
export const STAGE_TOP_INSET = TOP_BAR_HEIGHT + ISLAND_MARGIN * 2
/** Filmstrip (80px) + margins. */
export const STAGE_BOTTOM_INSET = FILMSTRIP_HEIGHT + ISLAND_MARGIN * 2

export interface StageInsets {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Drawers overlay the stage (Figma model): the insets only reserve the
 * top bar, the filmstrip and the outer margins, never the drawer widths.
 */
export function stageInsets(): StageInsets {
  return {
    left: ISLAND_MARGIN * 2,
    right: ISLAND_MARGIN * 2,
    top: STAGE_TOP_INSET,
    bottom: STAGE_BOTTOM_INSET,
  }
}
