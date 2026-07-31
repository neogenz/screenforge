/**
 * Floating-chrome layout constants.
 *
 * The canvas is full-bleed; panels float above it. `stageInsets` computes the
 * clear rectangle the fit logic must target so artboards never hide behind
 * the islands.
 */

export const ISLAND_MARGIN = 12
export const LAYERS_PANEL_WIDTH = 264
export const PROPERTIES_PANEL_WIDTH = 304
/** Toolbar (44px) + margins above and below. */
export const STAGE_TOP_INSET = 60
/** Screens strip (~132px) + margins. */
export const STAGE_BOTTOM_INSET = 168

export interface StageInsets {
  left: number
  right: number
  top: number
  bottom: number
}

export function stageInsets(showLayersPanel: boolean, showPropertiesPanel: boolean): StageInsets {
  return {
    left: (showLayersPanel ? LAYERS_PANEL_WIDTH : 0) + ISLAND_MARGIN * 2,
    right: (showPropertiesPanel ? PROPERTIES_PANEL_WIDTH : 0) + ISLAND_MARGIN * 2,
    top: STAGE_TOP_INSET,
    bottom: STAGE_BOTTOM_INSET,
  }
}
