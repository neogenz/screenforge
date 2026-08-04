/** Numeric helpers — single clamping implementation for all editors. */

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function finiteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback
}

export function roundTo(value: number, precision = 0): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}
