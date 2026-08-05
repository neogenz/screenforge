import { describe, expect, it } from 'vitest'
import { layerDisplayName } from '@/lib/layer-factories'
import { formatPercent } from '@/lib/number'

describe('layerDisplayName', () => {
  it('shows the content of a text layer that was never renamed', () => {
    expect(layerDisplayName({ type: 'text', name: 'Texte', content: 'Titre accrocheur' })).toBe(
      'Titre accrocheur',
    )
  })

  it('keeps the first line of a multiline content', () => {
    expect(layerDisplayName({ type: 'text', name: 'Texte', content: 'Titre\nSous-titre' })).toBe(
      'Titre',
    )
  })

  it('keeps a name the user chose', () => {
    expect(layerDisplayName({ type: 'text', name: 'Accroche', content: 'Titre accrocheur' })).toBe(
      'Accroche',
    )
  })

  it('falls back to the name when the content is blank', () => {
    expect(layerDisplayName({ type: 'text', name: 'Texte', content: '   ' })).toBe('Texte')
    expect(layerDisplayName({ type: 'text', name: 'Texte' })).toBe('Texte')
  })

  it('leaves every other layer type alone', () => {
    expect(layerDisplayName({ type: 'shape', name: 'Rectangle' })).toBe('Rectangle')
    expect(layerDisplayName({ type: 'device-frame', name: 'iPhone' })).toBe('iPhone')
  })
})

describe('formatPercent', () => {
  it('separates the sign with a narrow no-break space', () => {
    expect(formatPercent(100)).toBe('100 %')
    expect(formatPercent(66.6)).toBe('67 %')
  })
})
