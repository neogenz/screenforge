import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '@/assets/templates'
import { canvasSize } from '@/lib/canvas/canvas-utils'
import { deviceModelPlatform } from '@screenforge/project-format'

describe('platform templates', () => {
  it('ships a contained editorial composition for iPad and Apple Watch', () => {
    const targets = TEMPLATES.filter((template) =>
      ['ipad-editorial', 'watch-focus'].includes(template.id),
    )
    expect(targets.map((template) => template.id)).toEqual(['ipad-editorial', 'watch-focus'])

    for (const template of targets) {
      const size = canvasSize(template.profileId)
      for (const layer of template.layers) {
        expect(layer.x, `${template.id}:${layer.id}:x`).toBeGreaterThanOrEqual(0)
        expect(layer.y, `${template.id}:${layer.id}:y`).toBeGreaterThanOrEqual(0)
        expect(layer.x + layer.width, `${template.id}:${layer.id}:width`).toBeLessThanOrEqual(
          size.width,
        )
        expect(layer.y + layer.height, `${template.id}:${layer.id}:height`).toBeLessThanOrEqual(
          size.height,
        )
      }
      const device = template.layers.find((layer) => layer.type === 'device-frame')
      expect(device?.type).toBe('device-frame')
      if (device?.type !== 'device-frame') continue
      expect(deviceModelPlatform(device.deviceModel)).toBe(
        template.profileId === 'ipad-13' ? 'ipad' : 'watch',
      )
    }
  })
})
