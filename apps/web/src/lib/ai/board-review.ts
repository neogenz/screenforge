import { type BoardSize } from '@/lib/canvas/canvas-utils'
import { APP_STORE_PROFILE } from '@/lib/dimensions'
import { onBoardRatio, tallestEmptyBandOf, type PlanBox } from '@/lib/ai/archetypes'
import { contrastRatio, READABLE } from '@/lib/ai/palette'
import { measuredHeight, measureWithCanvas, type TextMeasure } from '@/lib/locale'
import type { Background, Layer, Screen, TextLayer } from '@/types'

/**
 * Ce qu'une planche a de mesurablement faux, dit à celui qui vient de la poser.
 *
 * Un agent qui compose par MCP ne voit qu'un PNG, et un PNG ne dit pas qu'une
 * boîte de 215 px contient cinq lignes de 19 px : il montre du texte coupé, ce
 * qui ressemble à un choix. Mesuré sur une vraie session, l'agent a jugé
 * « correct » quatre planches dont quatre appareils sur six étaient décapités.
 *
 * Les six règles ne sont pas inventées ici : ce sont celles que le générateur
 * local s'impose déjà dans `archetypes.test.ts`, appliquées cette fois à ce que
 * quelqu'un d'autre a posé. Un dépôt qui exige d'un agent ce qu'il ne
 * s'imposerait pas à lui-même n'a aucune autorité pour le lui dire.
 *
 * Rien ici ne juge une intention : une composition qui déborde exprès du cadre
 * est légitime, et c'est pourquoi le résultat est un constat à côté de l'image,
 * jamais une erreur. La mesure est injectable pour la même raison que dans
 * `reviewLocale` — un test qui dépendrait d'une police chargée mesurerait le
 * repli du navigateur, pas la composition.
 */

export type BoardFindingKind =
  /** Le texte occupe plus de hauteur que la boîte dessinée pour lui. */
  | 'overflow'
  /** La boîte sort du cadre de la planche. */
  | 'off-canvas'
  /** L'appareil est coupé au point que la capture n'est plus lisible. */
  | 'device-cropped'
  /** L'encre d'un texte ne tient pas 4,5:1 sur le fond de l'écran. */
  | 'contrast'
  /** Deux textes se recouvrent : l'un des deux est illisible. */
  | 'overlap'
  /** Une bande de planche que rien n'occupe, sur plus d'un quart de sa hauteur. */
  | 'empty-band'

export interface BoardFinding {
  kind: BoardFindingKind
  /** Absent quand le constat porte sur la planche et non sur un calque. */
  layerId?: string
  /** Une phrase courte, portant le calque et le chiffre. C'est ce qui est relu. */
  detail: string
}

/**
 * Le seuil d'alerte, et pourquoi il n'est pas celui du générateur.
 *
 * `archetypes.test.ts` exige 90 % : c'est ce qu'une composition que le dépôt
 * signe s'impose. 70 % est autre chose — le point où un appareil n'est plus
 * cadré mais tronqué. Alerter à 90 % sur des planches composées à la main
 * noierait le constat sous des signalements que personne ne veut, et un constat
 * qu'on apprend à ignorer ne vaut pas mieux que pas de constat.
 */
const DEVICE_ON_BOARD = 0.7

/** Un quart de planche, la règle que `tallestEmptyBand` sert déjà. */
function isText(layer: Layer): layer is TextLayer {
  return layer.type === 'text'
}

/** Toutes les couleurs qu'un fond pose, dégradé compris. */
function backgroundColors(background: Background): string[] {
  return background.type === 'solid'
    ? [background.color]
    : background.stops.map((stop) => stop.color)
}

function box(layer: Layer): PlanBox {
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
}

/** Les deux boîtes se recouvrent-elles, et de combien ? */
function overlapArea(left: PlanBox, right: PlanBox): number {
  const width = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x)
  const height = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)
  return width > 0 && height > 0 ? width * height : 0
}

function side(layer: Layer, board: BoardSize): string {
  const out: string[] = []
  if (layer.x < 0) out.push('à gauche')
  if (layer.y < 0) out.push('en haut')
  if (layer.x + layer.width > board.width) out.push('à droite')
  if (layer.y + layer.height > board.height) out.push('en bas')
  return out.join(' et ')
}

/**
 * Les six mesures d'une planche, dans l'ordre où elles se corrigent.
 *
 * Les calques partagés en font partie : ils sont rendus sur cette planche comme
 * les autres, donc un titre commun qui déborde déborde ici. Même désignation
 * que `refreshTargets` et `reviewLocale`, pour que les trois listes se lisent
 * pareil.
 */
export function reviewBoard(
  screen: Screen,
  layoutLayers: readonly Layer[] = [],
  measure: TextMeasure = measureWithCanvas,
  board: BoardSize = APP_STORE_PROFILE.board,
): BoardFinding[] {
  const findings: BoardFinding[] = []
  const layers = [...layoutLayers, ...screen.layers].filter((layer) => layer.visible)
  const texts = layers.filter(isText)
  const colors = backgroundColors(screen.background)

  for (const layer of texts) {
    const height = measuredHeight(layer, layer.fontFamily, measure)
    if (height > layer.height + 0.5) {
      findings.push({
        kind: 'overflow',
        layerId: layer.id,
        detail: `« ${layer.name} » : ${Math.round(height)} px de texte dans une boîte de ${Math.round(layer.height)} px.`,
      })
    }

    /* Chaque arrêt du fond, pas seulement le premier : une accroche blanche
       posée sur un dégradé qui finit en clair est lisible en haut et perdue en
       bas, et un seul rapport le tairait. */
    for (const color of colors) {
      const ratio = contrastRatio(color, layer.color)
      if (ratio < READABLE) {
        findings.push({
          kind: 'contrast',
          layerId: layer.id,
          detail: `« ${layer.name} » : ${ratio.toFixed(2)}:1 sur ${color}, il en faut ${READABLE}:1.`,
        })
      }
    }
  }

  /* Sur les textes seulement, et c'est mesuré : la première version accusait
     toute boîte débordante, et elle a signalé la « Goutte » que `bord-coupe`
     fait sortir du cadre exprès — un accent qui saigne est une composition,
     que ce dépôt revendique ailleurs. Un mot qui sort du cadre, lui, est
     perdu à l'export. Même périmètre que le `off-canvas` de `reviewLocale`,
     pour que les deux revues ne se contredisent pas sur la même planche.
     L'appareil a sa propre mesure, plus fine que « dedans ou dehors ». */
  for (const layer of texts) {
    const outside = side(layer, board)
    if (outside) {
      findings.push({
        kind: 'off-canvas',
        layerId: layer.id,
        detail: `« ${layer.name} » sort de la planche ${outside}.`,
      })
    }
  }

  for (const layer of layers) {
    if (layer.type === 'device-frame') {
      const ratio = onBoardRatio(box(layer), board)
      if (ratio < DEVICE_ON_BOARD) {
        findings.push({
          kind: 'device-cropped',
          layerId: layer.id,
          detail: `« ${layer.name} » : ${Math.round(ratio * 100)} % de l’appareil sur la planche, il en faut ${DEVICE_ON_BOARD * 100} %.`,
        })
      }
    }
  }

  /* Texte contre texte seulement. Une pastille de forme sous une accroche est
     une composition — `texte-sur-appareil` en pose une — et un appareil sous un
     titre est la mise en page normale. Deux accroches superposées, en revanche,
     n'ont aucune lecture : c'est le défaut mesuré, 78 px de recouvrement entre
     deux morceaux d'une même phrase coupée en calques. */
  for (let left = 0; left < texts.length; left += 1) {
    for (let right = left + 1; right < texts.length; right += 1) {
      const area = overlapArea(box(texts[left]), box(texts[right]))
      if (area <= 0) continue
      findings.push({
        kind: 'overlap',
        layerId: texts[left].id,
        detail: `« ${texts[left].name} » et « ${texts[right].name} » se recouvrent sur ${Math.round(area)} px².`,
      })
    }
  }

  const band = tallestEmptyBandOf(layers.map(box), board)
  if (band > board.height / 4) {
    findings.push({
      kind: 'empty-band',
      detail: `${Math.round(band)} px de planche sans rien, sur une hauteur de ${board.height}.`,
    })
  }

  return findings
}
