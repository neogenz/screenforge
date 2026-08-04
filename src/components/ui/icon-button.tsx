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
    'data-[active=true]:bg-secondary data-[active=true]:text-foreground',
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
  extends Omit<ButtonProps, 'size' | 'variant' | 'loading'>,
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
