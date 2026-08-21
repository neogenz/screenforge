import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '@/assets/templates'
import { getStoreTargetProfile } from '@/lib/dimensions'

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
})
