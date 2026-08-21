import { describe, expect, it } from 'vitest'
import { cloudUsageState, formatCloudBytes } from '@/lib/cloud-usage'

describe('usage Cloud', () => {
  it('classe les frontières sans masquer un dépassement historique', () => {
    expect(cloudUsageState(null, 100)).toBe('unavailable')
    expect(cloudUsageState(0, 100)).toBe('normal')
    expect(cloudUsageState(79, 100)).toBe('normal')
    expect(cloudUsageState(80, 100)).toBe('near')
    expect(cloudUsageState(100, 100)).toBe('reached')
    expect(cloudUsageState(101, 100)).toBe('reached')
  })

  it('formate les octets en Mio entiers et prudents', () => {
    expect(formatCloudBytes(0)).toBe('0 Mio')
    expect(formatCloudBytes(1024)).toBe('< 1 Mio')
    expect(formatCloudBytes(1024 * 1024)).toBe('1 Mio')
    expect(formatCloudBytes(1.9 * 1024 * 1024)).toBe('1 Mio')
  })
})
