import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '@/assets/templates'
import { getStoreTargetProfile } from '@/lib/dimensions'
import { deviceModelFamily } from '@screenforge/project-format'

describe('built-in templates', () => {
  it.each(['app-store-iphone', 'google-play-phone'] as const)(
    'ships five compatible layouts for %s',
    (target) => {
      const board = getStoreTargetProfile(target).board
      const templates = TEMPLATES.filter((template) => template.target === target)
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
    'ships a contained device-family layout for %s',
    (target) => {
      const profile = getStoreTargetProfile(target)
      const templates = TEMPLATES.filter((template) => template.target === target)
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
