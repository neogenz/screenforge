import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const base =
  'inline-flex items-center justify-center rounded-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2'

/*
 * Primaire = citron plein, encre sombre : la couleur d'état de l'éditeur
 * devient l'action de la vitrine. Le fantôme reste neutre pour la hiérarchie.
 */
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
        'bg-marker text-marker-ink hover:bg-marker-hover',
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
