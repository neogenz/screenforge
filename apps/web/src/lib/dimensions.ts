import type { DisplayClass } from '@/types'

export const MAX_PROJECT_SCREENS = 10

/**
 * The only production profile ScreenForge exports.
 * App Store Connect derives the smaller iPhone screenshot sizes from this set.
 */
export const APP_STORE_TARGET: DisplayClass = {
  name: 'iPhone 6.9 inch',
  size: '6.9"',
  portrait: { width: 1320, height: 2868 },
  landscape: { width: 2868, height: 1320 },
  devices: ['iPhone 16 Pro Max'],
  isPrimary: true,
  isLegacy: false,
}

/** Compatibility aliases used by the export UI until the export phase. */
export const PRIMARY_DIMENSION = APP_STORE_TARGET
export const DISPLAY_CLASSES: Record<string, DisplayClass> = {
  [APP_STORE_TARGET.size]: APP_STORE_TARGET,
}
export const EXPORT_DIMENSIONS = [APP_STORE_TARGET]

export function getDisplayClass(size: string): DisplayClass | undefined {
  return size === APP_STORE_TARGET.size ? APP_STORE_TARGET : undefined
}
