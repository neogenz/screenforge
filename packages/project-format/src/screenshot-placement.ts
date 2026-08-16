import type { ScreenshotPlacement } from './types.ts'

/**
 * Le vocabulaire du cadrage d'une capture dans l'ouverture de l'appareil :
 * le défaut, ses bornes, et la fonction qui y ramène n'importe quelle valeur.
 *
 * La géométrie proprement dite — le rectangle de dessin — reste côté éditeur
 * (`apps/web/src/lib/screenshot-placement.ts`) : elle sert au rendu, pas au
 * contrat. Ici ne vit que ce que la validation du projet doit connaître.
 */

export const DEFAULT_SCREENSHOT_PLACEMENT: ScreenshotPlacement = {
  mode: 'cover',
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
}

/**
 * `cover` + centre + zoom 1 est exactement `xMidYMid slice`. Le défaut n'est
 * donc pas un choix de goût : c'est ce que rendaient déjà tous les projets
 * existants, réécrit dans un vocabulaire que le modèle peut porter.
 */

export const MIN_SCREENSHOT_ZOOM = 0.25
export const MAX_SCREENSHOT_ZOOM = 4

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Ramène un placement quelconque dans ses bornes, sans jamais échouer. */
export function normalizeScreenshotPlacement(
  placement: Partial<ScreenshotPlacement> | undefined,
): ScreenshotPlacement {
  const mode = placement?.mode
  return {
    mode: mode === 'contain' || mode === 'fill' ? mode : 'cover',
    focusX: clamp(Number(placement?.focusX ?? 0.5) || 0, 0, 1),
    focusY: clamp(Number(placement?.focusY ?? 0.5) || 0, 0, 1),
    zoom: clamp(Number(placement?.zoom) || 1, MIN_SCREENSHOT_ZOOM, MAX_SCREENSHOT_ZOOM),
  }
}
