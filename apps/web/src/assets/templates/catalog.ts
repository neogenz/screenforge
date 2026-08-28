import { getDefaultDeviceSize } from '@/assets/device-frames'
import { getStoreTargetProfile, STORE_TARGET_IDS, STORE_TARGET_PROFILES } from '@/lib/dimensions'
import {
  ARCHETYPE_IDS,
  archetypeSpec,
  backgroundFor,
  composeArchetype,
  LINE_HEIGHT,
  type ArchetypeId,
  type PlanAccent,
} from '@/lib/ai/archetypes'
import { DIRECTIONS } from '@/lib/ai/plan'
import { createShapeLayer } from '@/lib/layer-factories'
import { deviceLayer, textLayer } from './layers'
import type { DeviceModel, Layer, ShapeLayer, StoreTargetId, TemplateDefinition } from '@/types'

/**
 * The 7 hand-written templates read as a starter kit, not a catalogue — the
 * user's complaint. `lib/ai/archetypes.ts` already knows 6 compositions that
 * work at any board size, and `lib/ai/plan.ts` already knows 4 colour
 * directions: this file is just their cross product, one `TemplateDefinition`
 * per (target × direction × archetype), rendered through the same
 * `composeArchetype` the campaign generator uses. No new layout logic.
 */

const CATALOG_HEADLINE = 'Titre accrocheur'

// ponytail: one board per device family (iphone/ipad/watch/android-phone),
// the shortest of each — mirrors how archetypes.test.ts's CASES picks a
// board per family. templates.test.ts imports this same constant, so a
// family added to dimensions.ts is picked up by both without a second
// hand-kept list to drift out of sync.
export const CATALOG_TARGETS: readonly StoreTargetId[] = (() => {
  const shortestPerFamily = new Map<string, StoreTargetId>()
  for (const id of STORE_TARGET_IDS) {
    const profile = STORE_TARGET_PROFILES[id]
    const current = shortestPerFamily.get(profile.family)
    if (!current || profile.board.height < STORE_TARGET_PROFILES[current].board.height) {
      shortestPerFamily.set(profile.family, id)
    }
  }
  return [...shortestPerFamily.values()]
})()

/* Les défauts d'une forme sont ceux de `createShapeLayer` ; le catalogue ne
   pose que la géométrie et la couleur de l'accent. */
function catalogShapeLayer(
  id: string,
  accent: PlanAccent,
  zIndex: number,
  board: { width: number; height: number },
): ShapeLayer {
  return {
    ...createShapeLayer(zIndex, accent.shape, board),
    id,
    x: accent.x,
    y: accent.y,
    width: accent.width,
    height: accent.height,
    rotation: accent.rotation,
    opacity: accent.opacity,
    fill: accent.color,
  }
}

function catalogTemplate(
  target: StoreTargetId,
  style: (typeof DIRECTIONS)[number],
  archetypeId: ArchetypeId,
  archetypeIndex: number,
): TemplateDefinition {
  const profile = getStoreTargetProfile(target)
  const board = profile.board
  const deviceModel = profile.defaultDeviceModel as DeviceModel
  const deviceFrame = getDefaultDeviceSize(deviceModel)
  const palette = { background: style.background, ink: style.ink, accent: style.accent }
  const background = backgroundFor(archetypeId, palette)
  const layout = composeArchetype(archetypeId, {
    palette,
    background,
    headline: CATALOG_HEADLINE,
    deviceAspect: deviceFrame.width / deviceFrame.height,
    index: archetypeIndex,
    board,
  })

  const id = `catalog-${target}-${style.id}-${archetypeId}`
  const layers: Layer[] = []
  let zIndex = 0

  for (const [index, accent] of layout.accentsBehind.entries()) {
    layers.push(catalogShapeLayer(`${id}-behind-${index}`, accent, zIndex++, board))
  }

  if (layout.device) {
    layers.push(
      deviceLayer(
        `${id}-device`,
        'Appareil',
        {
          x: layout.device.x,
          y: layout.device.y,
          width: layout.device.width,
          height: layout.device.height,
          rotation: layout.device.rotation,
          zIndex: zIndex++,
        },
        profile.defaultDeviceColor,
        deviceModel,
      ),
    )
  }

  for (const [index, accent] of layout.accentsFront.entries()) {
    layers.push(catalogShapeLayer(`${id}-front-${index}`, accent, zIndex++, board))
  }

  // ponytail: composeArchetype sizes the headline box in fixed pixels tuned
  // against the iPhone board (956 tall); the Watch board is short enough
  // (~525) that 'bas-ancre' — headline anchored at y=0.66 — overflows the
  // bottom edge by a couple of px. Text must stay strictly on-board (unlike
  // the decorative shapes and the device, which are allowed to bleed), so
  // clamp locally rather than touching the shared archetype geometry that the
  // campaign generator also relies on.
  // `layout.headline.y` is already an integer (composeArchetype rounds it);
  // floor rather than round the ceiling term, or rounding a fractional
  // board.height up (524.615 → 525) would put the clamp itself back over
  // the edge it exists to stay inside of.
  const headlineY = Math.min(
    layout.headline.y,
    Math.floor(Math.max(0, board.height - layout.headline.height)),
  )

  layers.push(
    textLayer(
      `${id}-headline`,
      'Titre',
      layout.headline.text,
      {
        x: layout.headline.x,
        y: headlineY,
        width: layout.headline.width,
        height: layout.headline.height,
        zIndex: zIndex++,
      },
      {
        fontSize: layout.headline.fontSize,
        fontWeight: layout.headline.fontWeight,
        color: layout.headline.color,
        textAlign: layout.headline.align,
        lineHeight: LINE_HEIGHT,
      },
    ),
  )

  const spec = archetypeSpec(archetypeId)
  return {
    id,
    target,
    name: spec.label,
    description: `Style ${style.label} · ${spec.label}`,
    direction: style.id,
    background,
    layers,
  }
}

export const CATALOG_TEMPLATES: TemplateDefinition[] = CATALOG_TARGETS.flatMap((target) =>
  DIRECTIONS.flatMap((style) =>
    ARCHETYPE_IDS.map((archetypeId, archetypeIndex) =>
      catalogTemplate(target, style, archetypeId, archetypeIndex),
    ),
  ),
)
