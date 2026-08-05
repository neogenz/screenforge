/**
 * Alignement et répartition d'une sélection.
 *
 * Géométrie pure : le module rend les nouvelles positions, l'appelant décide
 * comment les écrire. C'est ce qui permet à une opération qui déplace dix
 * calques de ne produire qu'un seul pas d'annulation.
 */

export type AlignMode = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'

export type DistributeMode = 'horizontal' | 'vertical'

export interface Placeable {
  x: number
  y: number
  width: number
  height: number
}

export interface Placement {
  x: number
  y: number
}

const HORIZONTAL: AlignMode[] = ['left', 'center-x', 'right']

/** Rectangle englobant une sélection, dans le même repère que les calques. */
export function boundsOf(items: Placeable[]): Placeable {
  const left = Math.min(...items.map((item) => item.x))
  const top = Math.min(...items.map((item) => item.y))
  const right = Math.max(...items.map((item) => item.x + item.width))
  const bottom = Math.max(...items.map((item) => item.y + item.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * @param reference l'artboard quand un seul calque est sélectionné, la boîte de
 * la sélection au-delà — aligner un calque isolé sur lui-même ne ferait rien.
 */
export function alignTo(items: Placeable[], mode: AlignMode, reference: Placeable): Placement[] {
  return items.map((item) => {
    if (HORIZONTAL.includes(mode)) {
      const x =
        mode === 'left'
          ? reference.x
          : mode === 'right'
            ? reference.x + reference.width - item.width
            : reference.x + (reference.width - item.width) / 2
      return { x, y: item.y }
    }
    const y =
      mode === 'top'
        ? reference.y
        : mode === 'bottom'
          ? reference.y + reference.height - item.height
          : reference.y + (reference.height - item.height) / 2
    return { x: item.x, y }
  })
}

/**
 * Espace régulier entre les calques, les deux extrêmes restant en place. Sous
 * trois calques il n'y a rien à répartir : les positions sont rendues telles
 * quelles plutôt que de faire échouer l'appelant.
 */
export function distribute(items: Placeable[], mode: DistributeMode): Placement[] {
  const placements = items.map((item) => ({ x: item.x, y: item.y }))
  if (items.length < 3) return placements

  const horizontal = mode === 'horizontal'
  const order = items
    .map((item, index) => ({ index, item }))
    .sort((left, right) => (horizontal ? left.item.x - right.item.x : left.item.y - right.item.y))

  const first = order[0].item
  const last = order[order.length - 1].item
  const start = horizontal ? first.x + first.width : first.y + first.height
  const end = horizontal ? last.x : last.y
  const occupied = order
    .slice(1, -1)
    .reduce((total, { item }) => total + (horizontal ? item.width : item.height), 0)
  // Un espace négatif signifie que les calques se chevauchent déjà : on le
  // laisse tel quel, la répartition reste régulière même si elle superpose.
  const gap = (end - start - occupied) / (order.length - 1)

  let cursor = start
  for (const { index, item } of order.slice(1, -1)) {
    cursor += gap
    if (horizontal) placements[index] = { x: cursor, y: item.y }
    else placements[index] = { x: item.x, y: cursor }
    cursor += horizontal ? item.width : item.height
  }
  return placements
}
