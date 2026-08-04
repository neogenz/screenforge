import type { ComponentProps } from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

export function ToggleGroup({ className, role = 'group', ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      role={role}
      className={cn(
        'inline-flex items-stretch gap-0.5 rounded-md border border-border bg-muted p-[3px]',
        className,
      )}
      {...props}
    />
  )
}

export function ToggleGroupItem({ className, role = 'button', ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      role={role}
      aria-checked={undefined}
      className={cn(
        // Rayon intérieur = rayon du groupe (9) moins la marge (3).
        'inline-flex h-8 items-center justify-center gap-1 rounded-sm px-2.5',
        'font-sans text-2xs font-medium',
        'transition-[background,color] duration-150 ease-out',
        'disabled:pointer-events-none disabled:opacity-40',
        // L'option active monte d'un palier : lisible sur panneau clair comme sombre,
        // là où une bordure claire seule disparaissait en thème clair.
        'data-[state=on]:bg-secondary data-[state=on]:text-foreground data-[state=on]:shadow-(--hairline-top)',
        'data-[state=off]:text-muted-foreground hover:data-[state=off]:bg-accent hover:data-[state=off]:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
