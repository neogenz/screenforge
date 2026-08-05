import { cva, type VariantProps } from 'class-variance-authority'
import type { InputHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  [
    'field-surface h-8 w-full px-2.5',
    'text-foreground placeholder:text-muted-foreground',
    'transition-[border-color] duration-150 ease-out',
    'hover:border-input focus:border-muted-foreground',
    // L'invalidité se signale sur la bordure, jamais sur le fond.
    'aria-invalid:border-destructive aria-invalid:hover:border-destructive aria-invalid:focus:border-destructive',
    'disabled:pointer-events-none disabled:opacity-40',
  ],
  {
    variants: {
      font: {
        /** Valeurs numériques : Inter a des chiffres tabulaires natifs. */
        tabular: 'text-sm tabular-nums',
        sans: 'text-sm',
      },
    },
    defaultVariants: { font: 'tabular' },
  },
)

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, VariantProps<typeof inputVariants> {
  ref?: Ref<HTMLInputElement>
}

export function Input({ font, className, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      data-slot="input"
      className={cn(inputVariants({ font }), className)}
      {...props}
    />
  )
}
