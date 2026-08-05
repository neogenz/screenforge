import { cva, type VariantProps } from 'class-variance-authority'
import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from '@/components/ui/button'

const iconButtonVariants = cva(
  [
    'border border-transparent bg-transparent text-muted-foreground',
    'hover:bg-accent hover:text-foreground',
    'focus-visible:border-input',
    'disabled:opacity-35',
    // Neutre, et non l'accent : ces boutons disent « ce panneau est ouvert »,
    // pas « c'est ici que vous travaillez ». L'accent est réservé à ce que
    // l'utilisateur édite — l'écran courant, le calque sélectionné, le focus.
    //
    // Trois canaux, et non le seul aplat. Mesuré, `bg-secondary` contre la carte
    // vaut 1,075:1 en clair quand `hover:bg-accent` en vaut 1,19 : survoler un
    // bouton inactif le faisait paraître plus sélectionné qu'un panneau ouvert.
    // La bordure et le filet de lumière sont ce que `ToggleGroupItem` emploie
    // déjà pour la même distinction.
    'data-[active=true]:border-input data-[active=true]:bg-secondary',
    'data-[active=true]:text-foreground data-[active=true]:shadow-(--hairline-top)',
  ],
  {
    variants: {
      size: {
        sm: 'size-8 rounded-md px-0',
        md: 'size-9 rounded-md px-0',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export interface IconButtonProps
  extends
    Omit<ButtonProps, 'size' | 'variant' | 'loading'>,
    VariantProps<typeof iconButtonVariants> {
  /** Every icon-only button must be labelled. */
  'aria-label': string
  active?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ size, active, className, ref, ...props }: IconButtonProps) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      data-slot="icon-button"
      data-active={active || undefined}
      className={cn(iconButtonVariants({ size }), className)}
      {...props}
    />
  )
}
