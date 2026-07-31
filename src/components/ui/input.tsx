import { cva, type VariantProps } from 'class-variance-authority'
import type { InputHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  [
    'h-7 w-full rounded-md border border-border bg-surface px-2 outline-none',
    'text-foreground placeholder:text-faint',
    'transition-[border-color,background] duration-150 ease-out',
    'hover:border-border-strong focus:border-foreground-muted',
  ],
  {
    variants: {
      font: {
        mono: 'font-mono text-[11px] tabular-nums',
        sans: 'font-sans text-[12px]',
      },
    },
    defaultVariants: { font: 'mono' },
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
