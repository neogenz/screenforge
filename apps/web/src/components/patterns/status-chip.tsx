import type { ReactNode } from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusTone = 'neutral' | 'brand' | 'success' | 'warning' | 'pulse'

/**
 * Le point d'état : six pixels, jamais le citron (il dit « vous êtes ici »).
 * `pulse` est « en cours » : la grise de l'arrêt qui respire, pas un
 * troisième gris illisible sur les deux thèmes.
 */
const DOT: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground/50',
  brand: 'bg-foreground',
  success: 'bg-success',
  warning: 'bg-destructive',
  pulse: 'bg-muted-foreground animate-pulse motion-reduce:animate-none',
}

export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span
      aria-hidden
      data-tone={tone}
      className={cn('size-1.5 shrink-0 rounded-full', DOT[tone], className)}
    />
  )
}

export interface StatusChipProps extends Omit<BadgeProps, 'variant' | 'children'> {
  tone: StatusTone
  /** Remplace le point (un spinner, un nuage). */
  icon?: ReactNode
  children: ReactNode
}

/**
 * Un état qui informe sans alerter : `Badge` coss `outline`, point ou icône
 * devant, libellé en casse normale. Le `role="status"` reste au consommateur,
 * qui sait ce qui doit être annoncé.
 */
export function StatusChip({ tone, icon, className, children, ...props }: StatusChipProps) {
  return (
    <Badge
      variant="outline"
      data-tone={tone}
      className={cn('gap-1.5 font-normal text-muted-foreground', className)}
      {...props}
    >
      {icon ?? <StatusDot tone={tone} />}
      {children}
    </Badge>
  )
}
