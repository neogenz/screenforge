import { getDefaultDeviceSize } from '@/assets/device-frames'
import { getStoreTargetProfile } from '@/lib/dimensions'
import {
  ARCHETYPE_IDS,
  archetypeSpec,
  backgroundFor,
  composeArchetype,
  type ArchetypeId,
  type PlanAccent,
} from '@/lib/ai/archetypes'
import { DIRECTIONS } from '@/lib/ai/plan'
import { shapeEntry } from '@/lib/vector-catalog'
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

const CATALOG_TARGETS: readonly StoreTargetId[] = [
  'app-store-iphone',
  'app-store-ipad-13',
  'app-store-watch-series-10',
  'google-play-phone',
]

function catalogShapeLayer(id: string, accent: PlanAccent, zIndex: number): ShapeLayer {
  return {
    id,
    type: 'shape',
    name: shapeEntry(accent.shape)?.label ?? 'Forme',
    x: accent.x,
    y: accent.y,
    width: accent.width,
    height: accent.height,
    rotation: accent.rotation,
    opacity: accent.opacity,
    locked: false,
    visible: true,
    zIndex,
    shapeType: accent.shape,
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
    layers.push(catalogShapeLayer(`${id}-behind-${index}`, accent, zIndex++))
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
    layers.push(catalogShapeLayer(`${id}-front-${index}`, accent, zIndex++))
  }

  // ponytail: composeArchetype sizes the headline box in fixed pixels tuned
  // against the iPhone board (956 tall); the Watch board is short enough
  // (~525) that 'bas-ancre' — headline anchored at y=0.66 — overflows the
  // bottom edge by a couple of px. Text must stay strictly on-board (unlike
  // the decorative shapes and the device, which are allowed to bleed), so
  // clamp locally rather than touching the shared archetype geometry that the
  // campaign generator also relies on.
  const headlineY = Math.min(layout.headline.y, Math.max(0, board.height - layout.headline.height))

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
        lineHeight: 1.2,
      },
    ),
  )

  const spec = archetypeSpec(archetypeId)
  return {
    id,
    target,
    name: spec.label,
    description: `Style ${style.label} · ${spec.label}`,
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
