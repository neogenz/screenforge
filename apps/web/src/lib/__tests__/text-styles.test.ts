import { describe, expect, it } from 'vitest'
import {
  isTextCharStyles,
  rangeFill,
  readCharStyles,
  sameCharStyles,
  setRangeFill,
  textColorEdit,
  textColorValue,
} from '@/lib/text-styles'
import type { TextLayer } from '@/types'

function textLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: 'text-1',
    type: 'text',
    name: 'Accroche',
    x: 0,
    y: 0,
    width: 400,
    height: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    content: 'Bonjour',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: 600,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    textTransform: 'none',
    ...overrides,
  } as TextLayer
}

describe('setRangeFill', () => {
  it('ne peint que les caractères visés', () => {
    expect(setRangeFill('Bonjour', undefined, 0, 3, '#ff0000')).toEqual({
      0: { 0: { fill: '#ff0000' }, 1: { fill: '#ff0000' }, 2: { fill: '#ff0000' } },
    })
  })

  it('compte le saut de ligne comme une position sans colonne', () => {
    // « B o n \n j o u r » : la position plate 4 est le « j », première colonne
    // de la deuxième ligne. C'est exactement l'endroit où un décalage d'un cran
    // passerait inaperçu à l'écran et se verrait à l'export.
    expect(setRangeFill('Bon\njour', undefined, 4, 6, '#00ff00')).toEqual({
      1: { 0: { fill: '#00ff00' }, 1: { fill: '#00ff00' } },
    })
  })

  it('ne se laisse pas décaler par un emoji', () => {
    // Fabric compte ses positions en graphèmes : « 🎉 » vaut une position pour
    // lui, deux unités UTF-16 pour `String.length`.
    expect(setRangeFill('🎉ab', undefined, 1, 2, '#0000ff')).toEqual({
      0: { 1: { fill: '#0000ff' } },
    })
  })

  it('dépeint, et rend le calque vierge plutôt qu’un objet vide', () => {
    const painted = setRangeFill('Bonjour', undefined, 0, 3, '#ff0000')
    expect(setRangeFill('Bonjour', painted, 0, 3, null)).toBeUndefined()
  })

  it('laisse en place ce qui est hors du passage', () => {
    const painted = setRangeFill('Bonjour', undefined, 0, 7, '#ff0000')
    const partial = setRangeFill('Bonjour', painted, 0, 3, null)
    expect(Object.keys(partial?.[0] ?? {})).toEqual(['3', '4', '5', '6'])
  })
})

describe('rangeFill', () => {
  it('rend la couleur commune, et rien si le passage est panaché', () => {
    const uniform = setRangeFill('Bonjour', undefined, 0, 3, '#ff0000')
    expect(rangeFill('Bonjour', uniform, 0, 3)).toBe('#ff0000')
    const mixed = setRangeFill('Bonjour', uniform, 2, 3, '#00ff00')
    expect(rangeFill('Bonjour', mixed, 0, 3)).toBeNull()
  })

  it('rend rien dès qu’un caractère du passage n’est pas peint', () => {
    const partial = setRangeFill('Bonjour', undefined, 0, 2, '#ff0000')
    expect(rangeFill('Bonjour', partial, 0, 3)).toBeNull()
  })
})

describe('readCharStyles', () => {
  it('ne retient que la couleur de ce que Fabric propose', () => {
    expect(
      readCharStyles({ 0: { 0: { fill: '#ff0000', fontWeight: 'bold', underline: true } } }),
    ).toEqual({ 0: { 0: { fill: '#ff0000' } } })
  })

  it('rend vierge ce qui ne porte aucune couleur lisible', () => {
    expect(readCharStyles({ 0: { 0: { fontWeight: 'bold' } } })).toBeUndefined()
    expect(readCharStyles({})).toBeUndefined()
    expect(readCharStyles(null)).toBeUndefined()
  })

  it('range ses clés, pour que deux styles égaux se comparent égaux', () => {
    const fromFabric = readCharStyles({ 2: { 1: { fill: '#fff' } }, 0: { 0: { fill: '#000' } } })
    const rebuilt = readCharStyles({ 0: { 0: { fill: '#000' } }, 2: { 1: { fill: '#fff' } } })
    expect(sameCharStyles(fromFabric, rebuilt)).toBe(true)
  })
})

describe('isTextCharStyles', () => {
  it('refuse ce que le rendu ne saurait pas relire', () => {
    expect(isTextCharStyles({ 0: { 0: { fill: '#fff' } } })).toBe(true)
    expect(isTextCharStyles({ a: { 0: { fill: '#fff' } } })).toBe(false)
    expect(isTextCharStyles({ 0: { 0: { fill: 42 } } })).toBe(false)
    expect(isTextCharStyles({ 0: [{ fill: '#fff' }] })).toBe(false)
    expect(isTextCharStyles([])).toBe(false)
  })
})

describe('textColorEdit', () => {
  it('peint le calque quand rien n’est surligné', () => {
    expect(textColorEdit(textLayer(), null, '#ff0000').updates).toEqual({ color: '#ff0000' })
  })

  it('peint le seul passage quand il y en a un', () => {
    const edit = textColorEdit(textLayer(), { layerId: 'text-1', start: 0, end: 3 }, '#ff0000')
    expect(edit.updates.color).toBeUndefined()
    expect(edit.updates.charStyles).toEqual({
      0: { 0: { fill: '#ff0000' }, 1: { fill: '#ff0000' }, 2: { fill: '#ff0000' } },
    })
  })

  it('ignore un passage qui appartient à un autre calque', () => {
    const edit = textColorEdit(textLayer(), { layerId: 'autre', start: 0, end: 3 }, '#ff0000')
    expect(edit.updates).toEqual({ color: '#ff0000' })
  })

  it('rend le passage au calque quand on le repeint de sa couleur', () => {
    const layer = textLayer({ charStyles: setRangeFill('Bonjour', undefined, 0, 3, '#ff0000') })
    const edit = textColorEdit(layer, { layerId: 'text-1', start: 0, end: 3 }, '#ffffff')
    expect(edit.updates.charStyles).toBeUndefined()
  })

  it('sépare deux passages dans l’historique', () => {
    const layer = textLayer()
    expect(
      textColorEdit(layer, { layerId: 'text-1', start: 0, end: 3 }, '#f00').coalesceKey,
    ).not.toBe(textColorEdit(layer, { layerId: 'text-1', start: 4, end: 7 }, '#f00').coalesceKey)
  })
})

describe('textColorValue', () => {
  it('retombe sur la couleur du calque pour un passage panaché', () => {
    const mixed = setRangeFill(
      'Bonjour',
      setRangeFill('Bonjour', undefined, 0, 3, '#ff0000'),
      2,
      3,
      '#00ff00',
    )
    const layer = textLayer({ charStyles: mixed })
    expect(textColorValue(layer, { layerId: 'text-1', start: 0, end: 3 })).toBe('#ffffff')
    expect(textColorValue(layer, { layerId: 'text-1', start: 0, end: 2 })).toBe('#ff0000')
  })
})
