import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  [
    'inline-flex select-none items-center justify-center outline-none',
    'border border-transparent bg-transparent text-muted',
    'transition-[background,color,border-color] duration-150 ease-out',
    'hover:bg-surface-hover hover:text-foreground',
    'focus-visible:border-border-strong',
    'disabled:pointer-events-none disabled:opacity-35',
    'data-[active=true]:bg-surface-active data-[active=true]:text-foreground',
  ],
  {
    variants: {
      size: {
        sm: 'h-7 w-7 rounded-md',
        md: 'h-8 w-8 rounded-lg',
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
