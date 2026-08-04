import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge<'sf-surface' | 'sf-accent' | 'sf-type'>({
  extend: {
    classGroups: {
      'sf-surface': [
        'field-surface',
        'island',
        'surface-inner',
        'surface-modal',
        'checkerboard',
        'menu-shadow',
        'hairline',
        'stage-vignette',
      ],
      'sf-accent': ['accent-fill', 'accent-mark'],
      'sf-type': ['panel-title', 'section-title', 'field-label', 'tabular'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
