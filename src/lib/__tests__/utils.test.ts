import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('keeps independent custom classes while merging Tailwind conflicts', () => {
    expect(cn('field-label', 'tabular')).toBe('field-label tabular')
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
