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

/**
 * Pourcentage affiché, une seule forme dans toute l'interface.
 *
 * L'opacité d'un calque rendait `100%` et celle d'une couleur `100 %` : deux
 * réglages voisins, deux typographies. La règle française veut une espace
 * insécable avant le signe, et c'est une fine (U+202F) — l'espace pleine
 * décollerait trop le signe dans une pastille de 44px.
 */
const NARROW_NO_BREAK_SPACE = '\u202f'

export function formatPercent(value: number): string {
  return `${Math.round(value)}${NARROW_NO_BREAK_SPACE}%`
}
