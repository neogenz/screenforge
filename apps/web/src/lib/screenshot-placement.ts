import type { ScreenshotPlacement, ScreenshotSize } from '@/types'
import { normalizeScreenshotPlacement } from '@screenforge/project-format/screenshot-placement'

export {
  DEFAULT_SCREENSHOT_PLACEMENT,
  MAX_SCREENSHOT_ZOOM,
  MIN_SCREENSHOT_ZOOM,
  normalizeScreenshotPlacement,
} from '@screenforge/project-format/screenshot-placement'

/**
 * Où la capture se pose dans l'ouverture de l'appareil.
 *
 * Les deux sites de rendu — le cadre généré (`assets/device-frames/index.ts`)
 * et le bezel Apple importé (`lib/canvas/canvas-utils.ts`) — posaient la
 * capture en `preserveAspectRatio="xMidYMid slice"`. C'est un cadrage correct,
 * et c'est le seul : le navigateur le calcule, rien ne le décrit, donc
 * l'utilisateur ne peut ni le régler ni, à la release suivante, le retrouver.
 * Un cadrage qu'on ne peut pas nommer ne survit pas au remplacement de la
 * capture, et c'est précisément ce qu'une campagne doit conserver.
 *
 * Le rectangle est donc calculé ici et écrit dans le SVG, `preserveAspectRatio`
 * passant à `none`. Une seule fonction le fait pour les deux sites : ils
 * avaient déjà divergé sur le découpage — le cadre généré découpe la capture au
 * `clipPath` de sa dalle, le bezel comptait sur le PNG opaque posé par-dessus.
 * Ce dernier suffisait tant que l'image ne pouvait pas dépasser l'ouverture ;
 * avec un zoom, elle le peut.
 *
 * Le vocabulaire du cadrage — défaut, bornes, normalisation — vit dans le
 * contrat partagé (`@screenforge/project-format/screenshot-placement`) : la
 * validation du projet en a besoin sans le rendu.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Le rectangle de dessin de la capture, dans le repère de l'ouverture.
 *
 * Sémantique de `object-fit` / `object-position` : l'échelle vient du mode, la
 * position vient du point focal appliqué à la marge — négative en `cover`, ce
 * qui fait glisser la partie visible plutôt que déplacer un vide.
 */
export function placeScreenshot(
  natural: ScreenshotSize,
  opening: Rect,
  placement: ScreenshotPlacement,
): Rect {
  const { mode, focusX, focusY, zoom } = placement
  const naturalWidth = Math.max(1, natural.width)
  const naturalHeight = Math.max(1, natural.height)

  let width: number
  let height: number
  if (mode === 'fill') {
    /* `fill` distord volontairement : c'est le seul mode où le rapport de la
       capture n'est pas conservé, et il existe pour les captures déjà prises au
       rapport exact de la dalle, qu'un ajustement ferait dériver d'un pixel. */
    width = opening.width * zoom
    height = opening.height * zoom
  } else {
    const scaleX = opening.width / naturalWidth
    const scaleY = opening.height / naturalHeight
    const scale = (mode === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY)) * zoom
    width = naturalWidth * scale
    height = naturalHeight * scale
  }

  return {
    x: opening.x + (opening.width - width) * focusX,
    y: opening.y + (opening.height - height) * focusY,
    width,
    height,
  }
}

export interface ScreenshotFrame extends Rect {
  preserveAspectRatio: string
}

/**
 * Ce que les deux sites de rendu écrivent dans leur `<image>`.
 *
 * Sans taille naturelle, aucun rectangle n'est calculable : c'est le cas de
 * tout projet enregistré avant cette version, dont la capture n'a jamais été
 * mesurée. On rend alors ce que le navigateur rendait déjà, à l'octet près,
 * plutôt que de deviner une taille ou de forcer un décodage pendant le rendu.
 * Le point focal et le zoom sont inopérants dans ce cas — l'interface de
 * cadrage mesure la capture avant de les proposer, donc l'utilisateur ne peut
 * pas les régler sans que la mesure existe.
 */
export function screenshotFrame(
  opening: Rect,
  placement: ScreenshotPlacement | undefined,
  natural: ScreenshotSize | undefined,
): ScreenshotFrame {
  const resolved = normalizeScreenshotPlacement(placement)
  if (!natural) {
    const fallback =
      resolved.mode === 'fill'
        ? 'none'
        : resolved.mode === 'contain'
          ? 'xMidYMid meet'
          : 'xMidYMid slice'
    return { ...opening, preserveAspectRatio: fallback }
  }
  return { ...placeScreenshot(natural, opening, resolved), preserveAspectRatio: 'none' }
}

/**
 * Le cadrage se conserve-t-il tel quel avec une capture d'un autre rapport ?
 *
 * Remplacer une capture ne doit jamais réécrire le layout en silence — c'est le
 * défaut relevé chez Open Screenshot Generator, dont le remplacement remet le
 * `screenshotRect` à zéro. Ici le placement est conservé sans condition ; cette
 * fonction sert seulement à prévenir, parce qu'un rapport différent déplace ce
 * qui est visible même à réglages identiques.
 */
export function placementSurvivesRatioChange(
  previous: ScreenshotSize | undefined,
  next: ScreenshotSize,
): boolean {
  if (!previous) return true
  const before = previous.width / Math.max(1, previous.height)
  const after = next.width / Math.max(1, next.height)
  /* Un millième de rapport, soit moins d'un pixel sur la hauteur d'une dalle
     d'iPhone : en deçà, prévenir serait du bruit. */
  return Math.abs(before - after) < 0.001
}
