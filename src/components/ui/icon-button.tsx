import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  [
    'inline-flex select-none items-center justify-center',
    'border border-transparent bg-transparent text-foreground-muted',
    'transition-[background,color,border-color] duration-150 ease-out',
    'hover:bg-raised-hover hover:text-foreground',
    'active:bg-raised-active',
    'focus-visible:border-border-strong',
    'disabled:pointer-events-none disabled:opacity-35',
    // Neutre, et non l'accent : ces boutons disent « ce panneau est ouvert »,
    // pas « c'est ici que vous travaillez ». L'accent est réservé à ce que
    // l'utilisateur édite — l'écran courant, le calque sélectionné, le focus.
    'data-[active=true]:bg-raised-active data-[active=true]:text-foreground',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 w-8 rounded-md',
        md: 'h-9 w-9 rounded-md',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Every icon-only button must be labelled. */
  'aria-label': string
  active?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ size, active, className, type = 'button', ref, ...props }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      data-active={active || undefined}
      className={cn(iconButtonVariants({ size }), className)}
      {...props}
    />
  )
}
