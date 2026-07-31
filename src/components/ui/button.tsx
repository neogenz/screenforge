import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap outline-none',
    'font-mono text-[10px] font-medium uppercase tracking-[0.08em]',
    'transition-[background,color,border-color,transform] duration-150 ease-out',
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
  ],
  {
    variants: {
      variant: {
        primary:
          'border border-foreground bg-foreground text-panel hover:bg-foreground-muted hover:border-foreground-muted',
        accent:
          'border border-export-strong bg-export-strong text-on-export hover:bg-export-strong-hover hover:border-export-strong-hover',
        secondary:
          'border border-border bg-transparent text-foreground-muted hover:bg-surface-hover hover:text-foreground hover:border-border-strong',
        ghost:
          'border border-transparent bg-transparent text-faint hover:bg-surface-hover hover:text-foreground',
        danger:
          'border border-border bg-transparent text-danger hover:bg-danger-soft hover:border-danger',
      },
      size: {
        sm: 'h-7 rounded-lg px-2.5',
        md: 'h-8 rounded-lg px-3',
        lg: 'h-9 rounded-lg px-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant, size, className, type = 'button', ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
