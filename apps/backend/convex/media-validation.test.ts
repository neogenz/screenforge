import { describe, expect, it } from 'vitest'
import { inspectMedia, MAX_MEDIA_PIXELS } from '@screenforge/project-format/media-validation'

const bytes = (value: string) => new TextEncoder().encode(value)

describe('inspection média partagée', () => {
  it('borne les dimensions et le type depuis les octets', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 7, 8, 0, 2, 0, 3, 0xff, 0xd9])
    expect(inspectMedia(jpeg, 'image/jpeg')).toEqual({ type: 'image/jpeg', width: 3, height: 2 })
    expect(inspectMedia(jpeg, 'image/png')).toBeNull()

    const tooManyPixels = `<svg width="${MAX_MEDIA_PIXELS}" height="2"/>`
    expect(inspectMedia(bytes(tooManyPixels), 'image/svg+xml')).toBeNull()
    expect(inspectMedia(bytes('<svg viewBox="0 0 4 5"/>'), 'image/svg+xml')).toEqual({
      type: 'image/svg+xml',
      width: 4,
      height: 5,
    })
  })

  it.each([
    '<!DOCTYPE svg><svg width="1" height="1"/>',
    '<!ENTITY x "x"><svg width="1" height="1"/>',
    '<svg width="1" height="1"><foreignObject/></svg>',
    '<svg width="1" height="1" onload="alert(1)"/>',
    '<svg width="1" height="1"><use xlink:href="//evil.test/a"/></svg>',
    '<svg width="1" height="1"><path style="fill:url(https://evil.test/a)"/></svg>',
    '<svg width="1" height="1"><path style="@IMPORT url(x)"/></svg>',
    '<s:svg xmlns:s="http://www.w3.org/2000/svg" width="1" height="1"/>',
  ])('refuse le SVG actif ou ambigu: %s', (source) => {
    expect(inspectMedia(bytes(source), 'image/svg+xml')).toBeNull()
  })

  it('accepte les fragments internes et les attributs SVG inertes', () => {
    const source =
      '<svg width="10px" height="20"><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><rect width="1" height="1" fill="url(#g)"/></svg>'
    expect(inspectMedia(bytes(source), 'image/svg+xml')).toEqual({
      type: 'image/svg+xml',
      width: 10,
      height: 20,
    })
  })
})
