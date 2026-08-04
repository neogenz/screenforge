/**
 * Accroche et repères d'alignement.
 *
 * Tout est exprimé en unités canvas. Le seuil arrive déjà divisé par le zoom :
 * mesuré en unités canvas il deviendrait inatteignable à 25% et collant à 200%,
 * alors que ce que l'utilisateur juge est une distance à l'écran.
 *
 * Ce module ne connaît ni Fabric ni le store — il prend des rectangles et rend
 * un décalage plus des segments à tracer. Les repères ne sont donc jamais des
 * objets du canvas : ils n'apparaissent ni dans la liste des calques, ni dans
 * l'historique, ni dans le PNG exporté.
 */

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** Segment à tracer. `axis: 'x'` désigne un trait vertical à l'abscisse `position`. */
export interface Guide {
  axis: 'x' | 'y'
  position: number
  from: number
  to: number
}

export interface SnapResult {
  dx: number
  dy: number
  guides: Guide[]
}

/** Tolérance de coïncidence pour décider qu'un repère est atteint, en unités canvas. */
const COINCIDENT = 0.5

/** Les trois prises d'une boîte sur un axe : bord amont, centre, bord aval. */
function anchors(box: Box, axis: 'x' | 'y'): [number, number, number] {
  return axis === 'x'
    ? [box.left, box.left + box.width / 2, box.left + box.width]
    : [box.top, box.top + box.height / 2, box.top + box.height]
}

function span(box: Box, axis: 'x' | 'y'): [number, number] {
  return axis === 'x'
    ? [box.top, box.top + box.height]
    : [box.left, box.left + box.width]
}

function shifted(box: Box, dx: number, dy: number): Box {
  return { ...box, left: box.left + dx, top: box.top + dy }
}

/**
 * Le décalage qui rapproche le plus une prise de la boîte mobile d'une prise
 * d'une cible, à condition de rester sous le seuil. À égalité c'est la première
 * cible qui l'emporte : l'appelant place l'artboard en tête, ses bords priment
 * donc sur ceux d'un calque voisin.
 */
function bestDelta(moving: Box, targets: Box[], axis: 'x' | 'y', threshold: number): number {
  let best = 0
  let shortest = threshold
  const movingAnchors = anchors(moving, axis)
  for (const target of targets) {
    for (const targetAnchor of anchors(target, axis)) {
      for (const movingAnchor of movingAnchors) {
        const delta = targetAnchor - movingAnchor
        const distance = Math.abs(delta)
        if (distance < shortest) {
          shortest = distance
          best = delta
        }
      }
    }
  }
  return best
}

/**
 * Les repères effectivement atteints une fois le décalage appliqué. Le segment
 * couvre la réunion des deux boîtes qu'il relie, comme dans tout éditeur de
 * maquette : c'est ce qui montre *avec quoi* le calque s'aligne.
 */
function guidesFor(moved: Box, targets: Box[], axis: 'x' | 'y'): Guide[] {
  const found = new Map<number, Guide>()
  const [movedFrom, movedTo] = span(moved, axis)
  for (const target of targets) {
    const [targetFrom, targetTo] = span(target, axis)
    for (const targetAnchor of anchors(target, axis)) {
      if (!anchors(moved, axis).some((a) => Math.abs(a - targetAnchor) <= COINCIDENT)) continue
      const existing = found.get(targetAnchor)
      const from = Math.min(movedFrom, targetFrom, existing?.from ?? Infinity)
      const to = Math.max(movedTo, targetTo, existing?.to ?? -Infinity)
      found.set(targetAnchor, { axis, position: targetAnchor, from, to })
    }
  }
  return [...found.values()]
}

/**
 * @param threshold distance d'accroche en unités canvas (pixels écran ÷ zoom)
 */
export function computeSnap(moving: Box, targets: Box[], threshold: number): SnapResult {
  if (targets.length === 0) return { dx: 0, dy: 0, guides: [] }
  const dx = bestDelta(moving, targets, 'x', threshold)
  const dy = bestDelta(moving, targets, 'y', threshold)
  const moved = shifted(moving, dx, dy)
  return {
    dx,
    dy,
    guides: [...guidesFor(moved, targets, 'x'), ...guidesFor(moved, targets, 'y')],
  }
}
