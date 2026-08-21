export type CloudUsageState = 'normal' | 'near' | 'reached' | 'unavailable'

export function cloudUsageState(value: number | null, limit: number): CloudUsageState {
  if (value === null) return 'unavailable'
  if (value >= limit) return 'reached'
  if (value >= limit * 0.8) return 'near'
  return 'normal'
}

export function formatCloudBytes(bytes: number): string {
  if (bytes === 0) return '0 Mio'
  if (bytes < 1024 * 1024) return '< 1 Mio'
  return `${Math.floor(bytes / (1024 * 1024))} Mio`
}
