import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '@/assets/templates'
import { ARCHETYPE_IDS, onBoardRatio } from '@/lib/ai/archetypes'
import { DIRECTIONS } from '@/lib/ai/plan'
import { getStoreTargetProfile } from '@/lib/dimensions'
import { deviceModelFamily } from '@screenforge/project-format'
import type { StoreTargetId } from '@/types'

const HAND_WRITTEN = TEMPLATES.filter((template) => !template.id.startsWith('catalog-'))
const GENERATED = TEMPLATES.filter((template) => template.id.startsWith('catalog-'))

const CATALOG_TARGETS = [
  'app-store-iphone',
  'app-store-ipad-13',
  'app-store-watch-series-10',
  'google-play-phone',
] as const satisfies readonly StoreTargetId[]

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
        if (layer.type === 'text') {
          // Text must never leave the board — an off-board headline is a lost
          // visual, not a stylistic choice.
          expect(layer.x, `${template.id}/${layer.id} x`).toBeGreaterThanOrEqual(0)
          expect(layer.y, `${template.id}/${layer.id} y`).toBeGreaterThanOrEqual(0)
          expect(layer.x + layer.width, `${template.id}/${layer.id} width`).toBeLessThanOrEqual(
            board.width,
          )
          expect(layer.y + layer.height, `${template.id}/${layer.id} height`).toBeLessThanOrEqual(
            board.height,
          )
        } else if (layer.type === 'device-frame') {
          // 'bord-coupe'/'bas-ancre' intentionally bleed the device off the
          // board (see archetypes.ts) — same 90% ScreenForge default read down
          // to the 70% floor archetypes.ts itself documents for an
          // automatically chosen device.
          expect(
            onBoardRatio(layer, board),
            `${template.id}/${layer.id} onBoardRatio`,
          ).toBeGreaterThanOrEqual(0.7)
        }
        // Decorative accent shapes ('carte'/'bord-coupe'/'mur') are allowed to
        // bleed off the board by design — no containment assertion for them.
      }
    }
  })
})
