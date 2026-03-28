import type { DisplayClass } from '@/types'

export const DISPLAY_CLASSES: Record<string, DisplayClass> = {
  '6.9"': {
    name: '6.9 inch',
    size: '6.9"',
    portrait: { width: 1320, height: 2868 },
    landscape: { width: 2868, height: 1320 },
    devices: ['iPhone 16 Pro Max'],
    isPrimary: true,
    isLegacy: false,
  },
  '6.7"': {
    name: '6.7 inch',
    size: '6.7"',
    portrait: { width: 1290, height: 2796 },
    landscape: { width: 2796, height: 1290 },
    devices: ['iPhone 16 Plus', 'iPhone 15 Pro Max', 'iPhone 15 Plus', 'iPhone 14 Pro Max'],
    isPrimary: true,
    isLegacy: false,
  },
  '6.5"': {
    name: '6.5 inch',
    size: '6.5"',
    portrait: { width: 1284, height: 2778 },
    landscape: { width: 2778, height: 1284 },
    devices: ['iPhone 13 Pro Max', 'iPhone 12 Pro Max', 'iPhone 11 Pro Max', 'iPhone XS Max'],
    isPrimary: false,
    isLegacy: false,
  },
  '6.3"': {
    name: '6.3 inch',
    size: '6.3"',
    portrait: { width: 1206, height: 2622 },
    landscape: { width: 2622, height: 1206 },
    devices: ['iPhone 16e'],
    isPrimary: false,
    isLegacy: false,
  },
  '6.1"': {
    name: '6.1 inch',
    size: '6.1"',
    portrait: { width: 1179, height: 2556 },
    landscape: { width: 2556, height: 1179 },
    devices: ['iPhone 16', 'iPhone 15', 'iPhone 14', 'iPhone 13', 'iPhone 12'],
    isPrimary: false,
    isLegacy: false,
  },
  '5.8"': {
    name: '5.8 inch',
    size: '5.8"',
    portrait: { width: 1125, height: 2436 },
    landscape: { width: 2436, height: 1125 },
    devices: ['iPhone X', 'iPhone XS', 'iPhone 11 Pro', 'iPhone 12 mini', 'iPhone 13 mini'],
    isPrimary: false,
    isLegacy: false,
  },
  '5.5"': {
    name: '5.5 inch',
    size: '5.5"',
    portrait: { width: 1242, height: 2208 },
    landscape: { width: 2208, height: 1242 },
    devices: ['iPhone 8 Plus', 'iPhone 7 Plus', 'iPhone 6s Plus'],
    isPrimary: false,
    isLegacy: true,
  },
  '4.7"': {
    name: '4.7 inch',
    size: '4.7"',
    portrait: { width: 750, height: 1334 },
    landscape: { width: 1334, height: 750 },
    devices: ['iPhone SE 2nd gen', 'iPhone SE 3rd gen', 'iPhone 8', 'iPhone 7', 'iPhone 6s'],
    isPrimary: false,
    isLegacy: true,
  },
  '4.0"': {
    name: '4.0 inch',
    size: '4.0"',
    portrait: { width: 640, height: 1136 },
    landscape: { width: 1136, height: 640 },
    devices: ['iPhone SE 1st gen', 'iPhone 5s'],
    isPrimary: false,
    isLegacy: true,
  },
}

/** Primary submission target — Apple auto-scales from this */
export const PRIMARY_DIMENSION = DISPLAY_CLASSES['6.9"']

/** Non-legacy export dimensions (for batch export options) */
export const EXPORT_DIMENSIONS = Object.values(DISPLAY_CLASSES).filter(
  (d) => !d.isLegacy,
)

export function getDisplayClass(size: string): DisplayClass | undefined {
  return DISPLAY_CLASSES[size]
}
