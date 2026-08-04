import { describe, expect, it } from 'vitest'
import { alignTo, boundsOf, distribute, type AlignMode } from '@/lib/align'

describe('alignment geometry', () => {
  const item = { x: 20, y: 30, width: 40, height: 60 }
  const reference = { x: 100, y: 200, width: 200, height: 300 }

  it('computes selection bounds for different sizes', () => {
    expect(boundsOf([
      { x: 20, y: 50, width: 80, height: 40 },
      { x: -10, y: 10, width: 20, height: 120 },
    ])).toEqual({ x: -10, y: 10, width: 110, height: 120 })
  })

  it.each<[AlignMode, { x: number; y: number }]>([
    ['left', { x: 100, y: 30 }],
    ['center-x', { x: 180, y: 30 }],
    ['right', { x: 260, y: 30 }],
    ['top', { x: 20, y: 200 }],
    ['center-y', { x: 20, y: 320 }],
    ['bottom', { x: 20, y: 440 }],
  ])('aligns a single item to %s', (mode, expected) => {
    expect(alignTo([item], mode, reference)).toEqual([expected])
  })

  it('aligns multiple items in the continuous layout coordinate system', () => {
    expect(alignTo([
      { x: 480, y: 30, width: 40, height: 60 },
      { x: 720, y: 10, width: 80, height: 20 },
    ], 'center-x', { x: 480, y: 0, width: 320, height: 956 })).toEqual([
      { x: 620, y: 30 },
      { x: 600, y: 10 },
    ])
  })

  it('distributes different widths horizontally while preserving the extremes', () => {
    expect(distribute([
      { x: 0, y: 1, width: 10, height: 10 },
      { x: 30, y: 2, width: 20, height: 10 },
      { x: 100, y: 3, width: 10, height: 10 },
    ], 'horizontal')).toEqual([
      { x: 0, y: 1 },
      { x: 45, y: 2 },
      { x: 100, y: 3 },
    ])
  })

  it('distributes different heights vertically while preserving the extremes', () => {
    expect(distribute([
      { x: 1, y: 0, width: 10, height: 10 },
      { x: 2, y: 30, width: 10, height: 20 },
      { x: 3, y: 100, width: 10, height: 10 },
    ], 'vertical')).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 45 },
      { x: 3, y: 100 },
    ])
  })
})
