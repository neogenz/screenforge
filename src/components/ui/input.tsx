import { cva, type VariantProps } from 'class-variance-authority'
import type { InputHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  [
    'field-surface h-8 w-full px-2.5',
    'text-foreground placeholder:text-faint',
    'transition-[border-color] duration-150 ease-out',
    'hover:border-border-strong focus:border-foreground-muted',
    // L'invalidité se signale sur la bordure, jamais sur le fond.
    'aria-invalid:border-danger aria-invalid:hover:border-danger aria-invalid:focus:border-danger',
    'disabled:pointer-events-none disabled:opacity-40',
  ],
  {
    variants: {
      font: {
        /** Valeurs numériques : Inter a des chiffres tabulaires natifs. */
        tabular: 'text-[12.5px] tabular-nums',
        sans: 'text-[12.5px]',
      },
    },
    defaultVariants: { font: 'tabular' },
  },
)

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  ref?: Ref<HTMLInputElement>
}

export function Input({ font, className, ref, ...props }: InputProps) {
  return <input ref={ref} className={cn(inputVariants({ font }), className)} {...props} />
}
