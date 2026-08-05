import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const base =
  'inline-flex items-center justify-center rounded-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2'

export function CtaPrimary({
  href,
  size = 'md',
  className,
  children,
}: {
  href: string
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={cn(
        base,
        'bg-primary text-primary-foreground hover:bg-primary/90',
        size === 'sm' ? 'h-8 px-3.5 text-[13px]' : 'h-10 px-5 text-sm',
        className,
      )}
    >
      {children}
    </a>
  )
}

export function CtaGhost({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={cn(
        base,
        'h-10 px-5 text-sm text-foreground shadow-[inset_0_0_0_1px_var(--color-input)] hover:bg-secondary',
        className,
      )}
    >
      {children}
    </a>
  )
}
