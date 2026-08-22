import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('keeps independent custom classes while merging Tailwind conflicts', () => {
    expect(cn('text-xs text-muted-foreground', 'tabular-nums')).toBe(
      'text-xs text-muted-foreground tabular-nums',
    )
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
