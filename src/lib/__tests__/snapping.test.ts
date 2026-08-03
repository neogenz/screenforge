import { describe, expect, it } from 'vitest'
import { computeSnap } from '@/lib/snapping'

describe('computeSnap', () => {
  it('aligns edges and centers within the threshold', () => {
    const target = { left: 100, top: 100, width: 100, height: 100 }
    expect(computeSnap(
      { left: 93, top: 94, width: 50, height: 50 },
      [target],
      8,
    )).toMatchObject({ dx: 7, dy: 6 })

    expect(computeSnap(
      { left: 126, top: 126, width: 50, height: 50 },
      [target],
      2,
    )).toMatchObject({ dx: -1, dy: -1 })
  })

  it('does not snap at or beyond the threshold', () => {
    expect(computeSnap(
      { left: 90, top: 90, width: 20, height: 20 },
      [{ left: 100, top: 100, width: 100, height: 100 }],
      5,
    )).toMatchObject({ dx: 0, dy: 0 })
  })

  it('gives the first target priority for equal distances', () => {
    const result = computeSnap(
      { left: 96, top: 0, width: 0, height: 10 },
      [
        { left: 100, top: 0, width: 0, height: 10 },
        { left: 92, top: 0, width: 0, height: 10 },
      ],
      5,
    )
    expect(result.dx).toBe(4)
  })
})
