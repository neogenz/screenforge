import type { TextCharStyles } from './types.ts'

/**
 * La forme d'un jeu de styles par caractère, telle que la validation du
 * projet l'exige : des clés ligne puis colonne, numériques et positives, et
 * une couleur non vide à chaque passage. L'édition, elle, reste côté éditeur
 * (`apps/web/src/lib/text-styles.ts`).
 */
export function isTextCharStyles(value: unknown): value is TextCharStyles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  for (const [line, columns] of Object.entries(value as Record<string, unknown>)) {
    if (!Number.isInteger(Number(line)) || Number(line) < 0) return false
    if (!columns || typeof columns !== 'object' || Array.isArray(columns)) return false
    for (const [column, style] of Object.entries(columns as Record<string, unknown>)) {
      if (!Number.isInteger(Number(column)) || Number(column) < 0) return false
      const fill = (style as { fill?: unknown } | null)?.fill
      if (typeof fill !== 'string' || !fill) return false
    }
  }
  return true
}
