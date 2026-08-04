import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTimestamp } from '@/lib/time'

describe('nextTimestamp', () => {
  afterEach(() => vi.restoreAllMocks())

  it('advances when the clock has not moved', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)
    expect(nextTimestamp(100)).toBe(101)
  })

  it('uses a newer clock value', () => {
    vi.spyOn(Date, 'now').mockReturnValue(200)
    expect(nextTimestamp(100)).toBe(200)
  })
})
