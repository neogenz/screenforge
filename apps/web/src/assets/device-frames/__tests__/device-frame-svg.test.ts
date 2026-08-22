import { describe, expect, it } from 'vitest'
import {
  DEVICE_FRAMES,
  CURRENT_DEVICE_FRAMES,
  currentDeviceFramesFor,
  deviceFrameOptionsFor,
  generateDeviceFrameSVG,
  getDeviceFrame,
  getDeviceRenderSize,
} from '@/assets/device-frames'
import { DEVICE_MODEL_IDS } from '@screenforge/project-format'

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

  it('covers the closed contract and offers two original frames per new platform', () => {
    expect(DEVICE_FRAMES.map((config) => config.model).sort()).toEqual([...DEVICE_MODEL_IDS].sort())
    expect(currentDeviceFramesFor('ipad')).toHaveLength(2)
    expect(currentDeviceFramesFor('watch')).toHaveLength(2)

    for (const config of [...currentDeviceFramesFor('ipad'), ...currentDeviceFramesFor('watch')]) {
      const svg = generateDeviceFrameSVG(config, config.colors[0].name)
      expect(svg, config.model).not.toMatch(/data-part="island"|data-part="notch"/)
      expect(svg, config.model).not.toMatch(/<image|href=|<text|data-part="logo"/i)
    }
  })

  it('keeps picker options on-profile while retaining same-platform legacy frames', () => {
    expect(deviceFrameOptionsFor('tablet-slate', 'iphone').map(({ model }) => model)).not.toContain(
      'tablet-slate',
    )
    expect(deviceFrameOptionsFor('iphone-16-pro-max', 'iphone')[0]?.model).toBe('iphone-16-pro-max')
    expect(
      deviceFrameOptionsFor('iphone-16-pro-max', 'ipad').map(({ platform }) => platform),
    ).toEqual(['ipad', 'ipad'])
  })
})
