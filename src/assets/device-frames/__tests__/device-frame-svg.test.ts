import { describe, expect, it } from 'vitest'
import {
  CURRENT_DEVICE_FRAMES,
  generateDeviceFrameSVG,
  getDeviceFrame,
  getDeviceRenderSize,
} from '@/assets/device-frames'

describe('generated device frame SVG', () => {
  it('renders one flat white frame and a simple island when empty', () => {
    const config = getDeviceFrame('iphone-17-pro-max')
    const svg = generateDeviceFrameSVG(config, config.colors[0].name)

    expect(svg.match(/data-part="frame"/g)).toHaveLength(1)
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('data-part="screen"')
    expect(svg).toContain('data-part="island"')
    expect(svg).not.toMatch(/linearGradient|<circle|stroke=|data-part="screenshot"/)
    expect(getDeviceRenderSize(config)).toEqual({ width: config.width, height: config.height })
  })

  it('clips a screenshot without redrawing its dynamic island', () => {
    const config = getDeviceFrame('iphone-17-pro-max')
    const svg = generateDeviceFrameSVG(config, config.colors[0].name, 'data:image/png;base64,a&b')

    expect(svg).toContain('data-part="screenshot"')
    expect(svg).toContain(`clip-path="url(#screen-clip-${config.model})"`)
    expect(svg).toContain('href="data:image/png;base64,a&amp;b"')
    expect(svg).not.toContain('data-part="island"')
  })

  it('keeps the physical notch over a screenshot', () => {
    const config = getDeviceFrame('iphone-16e')
    const svg = generateDeviceFrameSVG(config, config.colors[0].name, 'data:image/png;base64,a')

    expect(svg).toContain('data-part="notch"')
    expect(svg).not.toContain('data-part="island"')
  })

  it('defaults every current model to a white frame', () => {
    for (const config of CURRENT_DEVICE_FRAMES) {
      expect(config.colors[0].frame, config.model).toBe('#ffffff')
    }
  })
})
