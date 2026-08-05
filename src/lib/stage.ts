/**
 * Floating-chrome layout constants — single source of truth.
 *
 * The canvas is full-bleed; the top bar, drawers and filmstrip float above
 * it. `stageInsets` computes the clear rectangle the fit logic must target
 * so artboards never hide behind the chrome.
 */

import { APP_STORE_TARGET } from './dimensions'

export const ISLAND_MARGIN = 12
/** Contrôle de 36 + le retrait d'îlot (2×6) + son filet (2×1). */
export const TOP_BAR_HEIGHT = 50
export const DRAWER_WIDTH_LAYERS = 280
export const DRAWER_WIDTH_PROPS = 320

/**
 * Hauteur de vignette dans la filmstrip. En deçà on ne distingue plus une mise
 * en page d'une autre, ce qui est le seul service que rend la bande.
 */
export const THUMBNAIL_HEIGHT = 100
/**
 * Largeur de vignette, déduite et jamais choisie : la bande montre l'artboard,
 * donc elle en montre le cadrage. Une tuile plus large que ce rapport ne fait
 * pas une vignette plus lisible, elle fait une vignette qui ment — l'aperçu est
 * en `object-cover`, et 14px de trop en largeur coupaient 21% de la hauteur de
 * la composition, en haut et en bas.
 */
export const THUMBNAIL_WIDTH = Math.round(
  (THUMBNAIL_HEIGHT * APP_STORE_TARGET.portrait.width) / APP_STORE_TARGET.portrait.height,
)
/**
 * Retrait propre à la pellicule, et non le retrait d'îlot. Les autres îlots
 * portent des contrôles à fleur de bord, où 6px font la règle « rayon intérieur
 * = rayon extérieur − retrait ». Ici le contenu ne touche pas le bord : c'est un
 * plateau, les tuiles y flottent. À 6px la marge extérieure était plus serrée
 * que l'écart entre deux tuiles (8), ce qui fait toujours lire un contenu comme
 * à l'étroit dans sa boîte.
 */
export const FILMSTRIP_PADDING = 12
/** Vignette + l'écart (8) + son libellé (20). */
export const THUMBNAIL_COLUMN_HEIGHT = THUMBNAIL_HEIGHT + 8 + 20
/**
 * Colonne + le retrait (2×12) + le filet (2×1). Sans le filet, la tuile
 * débordait d'un pixel en haut et en bas.
 */
export const FILMSTRIP_HEIGHT = THUMBNAIL_COLUMN_HEIGHT + FILMSTRIP_PADDING * 2 + 2

/**
 * Gouttière réservée au HUD de zoom, de chaque côté de la pellicule centrée.
 *
 * La pellicule est centrée sur la fenêtre et le HUD ancré à droite : sans
 * réserve, les deux se recouvraient de 15px sous 430px de large et le HUD
 * prenait le clic destiné à la dernière vignette. 160 = le HUD (134 mesuré à
 * « 100 % ») + sa marge (12) + un écart franc (14).
 */
export const FILMSTRIP_SIDE_GUTTER = 160
/** Largeur maximale de la pellicule, bornée par les deux gouttières. */
export const FILMSTRIP_MAX_WIDTH = `min(760px, calc(100vw - ${FILMSTRIP_SIDE_GUTTER * 2}px))`

/**
 * Largeur de scène sous laquelle l'aperçu cesse de rendre service.
 *
 * Une planche 1320×2868 posée dans moins que cela se lit comme la vignette de
 * la pellicule : on distingue une mise en page d'une autre, on ne juge plus
 * rien. C'est le seuil qui décide combien de tiroirs tiennent à l'écran, et à
 * partir d'où l'éditeur annonce sa largeur minimale au lieu de se déformer.
 */
export const MIN_STAGE_WIDTH = 240
/**
 * Largeur en deçà de laquelle les deux tiroirs ne peuvent plus coexister.
 *
 * Trois marges : celle de chaque bord, plus celle entre un tiroir et la scène.
 * Sous ce seuil l'ouverture devient exclusive — mesuré avant : à 375px les deux
 * tiroirs se recouvraient de 249px et le panneau Calques disparaissait sous
 * Propriétés, sans que rien ne le dise.
 */
export const DUAL_DRAWER_MIN_WIDTH =
  ISLAND_MARGIN * 3 + DRAWER_WIDTH_LAYERS + DRAWER_WIDTH_PROPS + MIN_STAGE_WIDTH
/**
 * Plancher de l'éditeur : un tiroir et une scène utile, rien de moins.
 *
 * En dessous, ScreenForge annonce sa largeur minimale plutôt que de rendre une
 * barre dont les contrôles sortent de l'écran. Un échec déclaré vaut mieux
 * qu'un échec silencieux — c'était le second qui était en place.
 */
export const MIN_APP_WIDTH = ISLAND_MARGIN * 3 + DRAWER_WIDTH_PROPS + MIN_STAGE_WIDTH
/**
 * Largeur sous laquelle la barre supérieure replie ses actions secondaires.
 *
 * Mesurée et non déduite : le contenu de la barre plancherait à 654px, elle
 * tenait encore à 700 et débordait de 118px à 560, où « Exporter » quittait
 * l'écran. Arrondi au palier standard immédiatement au-dessus.
 */
export const TOP_BAR_COMPACT_WIDTH = 768

/** Top bar (50px) + margins above and below. */
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
