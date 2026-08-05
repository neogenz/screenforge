import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/*
 * Micro-label technique — la voix blueprint de la page. Réservé aux mentions
 * de spécification (dimensions, noms de section), jamais au corps de texte.
 */
export function SpecLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-2xs font-medium tracking-[0.14em] text-muted-foreground uppercase',
        className,
      )}
    >
      {children}
    </p>
  )
}
