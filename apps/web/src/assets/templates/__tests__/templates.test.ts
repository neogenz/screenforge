import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '@/assets/templates'
import { CATALOG_TARGETS } from '@/assets/templates/catalog'
import {
  ARCHETYPE_IDS,
  SAFE_ARCHETYPE_IDS,
  archetypeSpec,
  onBoardRatio,
  tallestEmptyBandOf,
} from '@/lib/ai/archetypes'
import { contrastRatio } from '@/lib/ai/palette'
import { DIRECTIONS } from '@/lib/ai/plan'
import { getStoreTargetProfile } from '@/lib/dimensions'
import { deviceModelFamily } from '@screenforge/project-format'
import type { DeviceFrameLayer, TextLayer } from '@/types'

const HAND_WRITTEN = TEMPLATES.filter((template) => !template.id.startsWith('catalog-'))
const GENERATED = TEMPLATES.filter((template) => template.id.startsWith('catalog-'))

describe('built-in templates', () => {
  it.each(['app-store-iphone', 'google-play-phone'] as const)(
    'ships five compatible hand-written layouts for %s',
    (target) => {
      const board = getStoreTargetProfile(target).board
      const templates = HAND_WRITTEN.filter((template) => template.target === target)
      expect(templates).toHaveLength(5)

      for (const template of templates) {
        for (const layer of template.layers) {
          expect(layer.x, `${template.id}/${layer.id} x`).toBeGreaterThanOrEqual(0)
          expect(layer.y, `${template.id}/${layer.id} y`).toBeGreaterThanOrEqual(0)
          expect(layer.x + layer.width, `${template.id}/${layer.id} width`).toBeLessThanOrEqual(
            board.width,
          )
          expect(layer.y + layer.height, `${template.id}/${layer.id} height`).toBeLessThanOrEqual(
            board.height,
          )
          if (target === 'google-play-phone' && layer.type === 'device-frame') {
            expect(layer.deviceModel).toBe('android-phone')
          }
        }
      }
    },
  )

  it.each(['app-store-ipad-13', 'app-store-watch-series-10'] as const)(
    'ships a contained hand-written device-family layout for %s',
    (target) => {
      const profile = getStoreTargetProfile(target)
      const templates = HAND_WRITTEN.filter((template) => template.target === target)
      expect(templates).toHaveLength(1)

      for (const layer of templates[0].layers) {
        expect(layer.x).toBeGreaterThanOrEqual(0)
        expect(layer.y).toBeGreaterThanOrEqual(0)
        expect(layer.x + layer.width).toBeLessThanOrEqual(profile.board.width)
        expect(layer.y + layer.height).toBeLessThanOrEqual(profile.board.height)
        if (layer.type === 'device-frame') {
          expect(deviceModelFamily(layer.deviceModel)).toBe(profile.family)
        }
      }
    },
  )
})

// La galerie livrée à la main (7 gabarits) lisait comme un pense-bête, pas un
// catalogue. `lib/ai/archetypes.ts` et `lib/ai/plan.ts` savent déjà composer
// 6 mises en page dans 4 directions de couleur à n'importe quel format de
// planche — ces gabarits ne sont donc rien de plus que ce produit croisé,
// rendu par la même `composeArchetype` que la campagne IA.
describe('generated catalogue (direction × archetype)', () => {
  it.each(CATALOG_TARGETS)('has all 4 directions × 6 archetypes for %s', (target) => {
    const templates = GENERATED.filter((template) => template.target === target)
    expect(templates).toHaveLength(DIRECTIONS.length * ARCHETYPE_IDS.length)

    for (const style of DIRECTIONS) {
      for (const archetype of ARCHETYPE_IDS) {
        const id = `catalog-${target}-${style.id}-${archetype}`
        expect(
          templates.some((template) => template.id === id),
          id,
        ).toBe(true)
      }
    }
  })

  it.each(CATALOG_TARGETS)('keeps the headline as the last (topmost) layer for %s', (target) => {
    const templates = GENERATED.filter((template) => template.target === target)
    expect(templates.length).toBeGreaterThan(0)
    for (const template of templates) {
      const last = template.layers[template.layers.length - 1]
      expect(last?.type, template.id).toBe('text')
    }
  })

  it.each(CATALOG_TARGETS)('keeps every layer readable within the board for %s', (target) => {
    const board = getStoreTargetProfile(target).board
    const templates = GENERATED.filter((template) => template.target === target)

    for (const template of templates) {
      for (const layer of template.layers) {
        if (layer.type !== 'text') continue
        // Text must never leave the board — an off-board headline is a lost
        // visual, not a stylistic choice. Devices and decorative shapes are
        // allowed to bleed by design (checked, and scoped, below).
        expect(layer.x, `${template.id}/${layer.id} x`).toBeGreaterThanOrEqual(0)
        expect(layer.y, `${template.id}/${layer.id} y`).toBeGreaterThanOrEqual(0)
        expect(layer.x + layer.width, `${template.id}/${layer.id} width`).toBeLessThanOrEqual(
          board.width,
        )
        expect(layer.y + layer.height, `${template.id}/${layer.id} height`).toBeLessThanOrEqual(
          board.height,
        )
      }
    }
  })

  // Les mêmes règles que archetypes.ts, relues sur les calques réellement
  // écrits (pas seulement l'ArchetypeLayout intermédiaire), pour les six
  // archétypes. Le plancher de 90 % ne vaut que pour ceux que l'assignation
  // automatique choisit (SAFE_ARCHETYPE_IDS) — 'bas-ancre' coupe l'appareil
  // par le haut par construction, voir archetypes.ts.
  it.each(CATALOG_TARGETS)(
    'holds each generated template to the archetype quality bar for %s',
    (target) => {
      const board = getStoreTargetProfile(target).board
      for (const style of DIRECTIONS) {
        for (const archetypeId of ARCHETYPE_IDS) {
          const id = `catalog-${target}-${style.id}-${archetypeId}`
          const template = GENERATED.find((candidate) => candidate.id === id)
          if (!template) throw new Error(`missing template ${id}`)
          const spec = archetypeSpec(archetypeId)
          const headline = template.layers.find(
            (layer): layer is TextLayer => layer.type === 'text',
          )
          const device = template.layers.find(
            (layer): layer is DeviceFrameLayer => layer.type === 'device-frame',
          )
          if (!headline) throw new Error(`no headline layer in ${id}`)

          if (device && SAFE_ARCHETYPE_IDS.includes(archetypeId)) {
            expect(onBoardRatio(device, board), `${id} onBoardRatio`).toBeGreaterThanOrEqual(0.9)
          }

          expect(tallestEmptyBandOf(template.layers, board), `${id} emptyBand`).toBeLessThan(
            board.height / 4,
          )

          if (device && !spec.headline.overDevice) {
            const apart =
              headline.y + headline.height <= device.y || headline.y >= device.y + device.height
            expect(apart, `${id} separation`).toBe(true)
          }

          const colors =
            template.background.type === 'solid'
              ? [template.background.color]
              : template.background.stops.map((stop) => stop.color)
          for (const color of colors) {
            expect(
              contrastRatio(color, headline.color),
              `${id} contrast on ${color}`,
            ).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    },
  )
})
