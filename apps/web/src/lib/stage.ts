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
 * Largeur d'un tiroir, ramenée à ce que la fenêtre peut porter.
 *
 * Un tiroir est posé en `fixed` à une marge du bord : sous 344px de large, le
 * plus grand des deux sortait de la fenêtre par l'autre bord. Il vaut mieux un
 * tiroir étroit qu'un tiroir dont on ne voit pas la moitié droite.
 */
export function drawerWidth(width: number): string {
  return `min(${width}px, calc(100vw - ${ISLAND_MARGIN * 2}px))`
}

/**
 * Hauteur de vignette dans la filmstrip. En deçà on ne distingue plus une mise
 * en page d'une autre, ce qui est le seul service que rend la bande.
 *
 * 116 et non 100 : la largeur en découle, et c'est elle qui décide de ce qu'un
 * libellé peut dire. À 46 de large il tenait six caractères, à 53 il en tient
 * neuf — la différence entre « Onboa… » et « Onboardi… ». Le gain se paie 16px
 * de bande, que l'aperçu rend en lisibilité.
 */
export const THUMBNAIL_HEIGHT = 116
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
 * Puce du numéro, posée sur l'aperçu.
 *
 * Sur l'aperçu et non sous lui : posée sur la scène, elle devait tenir contre
 * deux thèmes et contre un aperçu presque toujours clair, et sa rangée coûtait
 * 26px de canevas. Sur l'image, elle n'a plus qu'une surface à contraster, et
 * son voile sombre l'y suffit quel que soit le contenu de la capture.
 */
export const THUMBNAIL_BADGE_SIZE = 16
/**
 * De combien l'écran courant se détache de la rangée.
 *
 * Un soulèvement plutôt qu'un anneau : mesuré, 2px de trait plein autour d'une
 * tuile large de 46 est le trait le plus épais de l'interface et se lit comme
 * un surligneur.
 */
export const THUMBNAIL_LIFT = 4
/**
 * L'écart entre deux tuiles : le 8 qui sépare, dans l'échelle fermée.
 *
 * Déclaré plutôt que laissé à `gap-2` parce que le glisser-déposer en a besoin
 * autant que la mise en page — c'est de combien une tuile se pousse pour faire
 * place à celle qu'on déplace, et les deux valeurs ne peuvent pas diverger.
 */
export const FILMSTRIP_GAP = 8
/** Le pas d'un rang à l'autre : la tuile et l'écart qui la suit. */
export const THUMBNAIL_SLOT = THUMBNAIL_WIDTH + FILMSTRIP_GAP
/**
 * Dégagement de la pellicule — pas un retrait d'îlot, la bande n'en est plus
 * un. C'est la place que la boîte défilante laisse à l'anneau de focus d'une
 * tuile : 2px de trait, 2px d'écart. Sans elle `overflow-x: auto` force
 * `overflow-y: auto`, et l'anneau y ferait apparaître une barre de défilement.
 */
export const FILMSTRIP_PADDING = 4
/**
 * La place rendue à la barre de défilement horizontale.
 *
 * Une barre classique se pose dans la boîte de rembourrage et rétrécit la zone
 * de contenu d'autant. La bande faisant exactement la hauteur de ce qu'elle
 * porte, le contenu ne tenait plus dès qu'elle apparaissait — et `overflow-x:
 * auto` forçant l'autre axe, une barre verticale se levait sur une rangée d'une
 * seule ligne. Le remède est de lui rendre sa hauteur, pas de la cacher : sur
 * une fenêtre étroite elle dit qu'il reste des écrans à droite.
 *
 * 12 couvre une barre fine (`scrollbar-width: thin`) sur les moteurs qui la
 * dimensionnent eux-mêmes. Réservée en permanence : sur une bande sans surface,
 * douze pixels transparents ne se voient pas, alors qu'une hauteur qui change
 * avec le nombre d'écrans ferait sauter la scène.
 */
export const FILMSTRIP_SCROLLBAR = 12
/** Hauteur du libellé, et l'écart qui le lie à ce qu'il nomme — le 6 qui lie. */
export const THUMBNAIL_LABEL_HEIGHT = 16
export const THUMBNAIL_LABEL_GAP = 6
export const THUMBNAIL_LABEL_ROW = THUMBNAIL_LABEL_GAP + THUMBNAIL_LABEL_HEIGHT

/**
 * L'aperçu, son dégagement, la place du soulèvement, et la rangée de libellés
 * quand il y a quelque chose à y écrire.
 *
 * Le soulèvement ne s'ajoute qu'en haut : la tuile courante sort de la boîte
 * défilante par là, et `overflow-x: auto` forçant l'autre axe, elle s'y ferait
 * rogner. Le compter des deux côtés ne réserverait rien de plus et coûterait
 * 4px de canevas.
 *
 * La rangée de libellés, elle, n'est pas réservée : tant qu'aucun écran n'a été
 * renommé, elle n'aurait à porter que « Écran 3 » sous un « 3 », et la bande
 * prendrait 22px au canevas pour répéter le badge.
 */
export function filmstripHeight(labelled: boolean): number {
  return (
    THUMBNAIL_HEIGHT +
    FILMSTRIP_PADDING * 2 +
    THUMBNAIL_LIFT +
    FILMSTRIP_SCROLLBAR +
    (labelled ? THUMBNAIL_LABEL_ROW : 0)
  )
}

/**
 * Gouttière réservée au HUD de zoom, de chaque côté de la pellicule centrée.
 *
 * La pellicule est centrée sur la fenêtre et le HUD ancré à droite : sans
 * réserve, les deux se recouvraient de 15px sous 430px de large et le HUD
 * prenait le clic destiné à la dernière vignette. 160 = le HUD (134 mesuré à
 * « 100 % ») + sa marge (12) + un écart franc (14).
 */
export const ZOOM_HUD_WIDTH = 134
export const FILMSTRIP_SIDE_GUTTER = ZOOM_HUD_WIDTH + ISLAND_MARGIN + 14
/**
 * Largeur maximale de la pellicule, bornée par les deux gouttières — et jamais
 * sous une tuile.
 *
 * Sans ce plancher la borne devient nulle à 320px de large puis négative en
 * dessous : une `max-width` négative est invalide, la déclaration saute, et la
 * bande reprend sa largeur naturelle par-dessus tout le reste. Une tuile et son
 * dégagement, c'est le minimum qui reste défilable ; la gouttière du HUD n'est
 * dépassée qu'en deçà de 361px, où il n'y a de toute façon plus de place pour
 * les deux.
 */
export const FILMSTRIP_MIN_WIDTH = THUMBNAIL_SLOT + FILMSTRIP_PADDING * 2
export const FILMSTRIP_MAX_WIDTH = `max(${FILMSTRIP_MIN_WIDTH}px, min(760px, calc(100vw - ${FILMSTRIP_SIDE_GUTTER * 2}px)))`
/**
 * Largeur sous laquelle la pellicule cesse d'être centrée sur la fenêtre.
 *
 * La gouttière suffit tant que la bande peut rétrécir ; une fois au plancher
 * elle ne rétrécit plus, et la bande centrée finit par mordre sur le HUD ancré
 * à droite — 27px mesurés à 320px de large, sur une bande qui n'a plus qu'une
 * tuile à montrer, et c'est le HUD qui prend le clic. Sous ce seuil la bande
 * s'ancre à gauche : elle a la place, le HUD ne bouge pas de là où on le
 * cherche, et le centrage revient dès que la fenêtre le permet.
 */
export const FILMSTRIP_CENTERED_MIN_WIDTH =
  FILMSTRIP_MIN_WIDTH + (ZOOM_HUD_WIDTH + ISLAND_MARGIN) * 2

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
 * Largeur sous laquelle la barre supérieure replie ses actions secondaires.
 *
 * Mesurée et non déduite : le contenu de la barre plancherait à 654px, elle
 * tenait encore à 700 et débordait de 118px à 560, où « Exporter » quittait
 * l'écran. Arrondi au palier standard immédiatement au-dessus.
 */
export const TOP_BAR_COMPACT_WIDTH = 768
/**
 * Largeur sous laquelle la barre replie aussi ses outils de création.
 *
 * Second palier, mesuré comme le premier : replier les seules actions
 * secondaires ne suffit plus en dessous. À 375px de fenêtre, l'îlot dispose de
 * 351px et la rangée en réclamait 526 — 253 d'outils, 257 d'actions, 16 de
 * gouttières — et « Exporter » repartait 173px hors de l'écran. Sans les
 * outils il en reste 273, de quoi porter la barre et un bout de nom de projet.
 * Arrondi au-dessus du besoin réel (570) pour ne pas replier au ras.
 */
export const TOP_BAR_TOOLS_WIDTH = 640

/** Top bar (50px) + margins above and below. */
export const STAGE_TOP_INSET = TOP_BAR_HEIGHT + ISLAND_MARGIN * 2
/** Pellicule + marges, selon qu'elle porte ou non sa rangée de libellés. */
export function stageBottomInset(labelled: boolean): number {
  return filmstripHeight(labelled) + ISLAND_MARGIN * 2
}
/**
 * Le pire cas, pour ce qui ne peut pas se recalculer à la volée.
 *
 * Les drawers bornent leur hauteur là-dessus : quand la bande est nue ils sont
 * 22px plus courts qu'ils ne pourraient l'être, ce qui ne se voit pas, alors
 * qu'un drawer trop long recouvrirait la pellicule dès le premier renommage.
 */
export const STAGE_BOTTOM_INSET_MAX = stageBottomInset(true)

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
  open: { layers?: boolean; props?: boolean; labelled?: boolean } = {},
): StageInsets {
  return {
    left: ISLAND_MARGIN * 2 + (open.layers ? DRAWER_WIDTH_LAYERS : 0),
    right: ISLAND_MARGIN * 2 + (open.props ? DRAWER_WIDTH_PROPS : 0),
    top: STAGE_TOP_INSET,
    bottom: stageBottomInset(open.labelled ?? false),
  }
}
