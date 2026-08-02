import { ChevronDown } from 'lucide-react'
import type { Ref, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>
}

/** Select natif habillé comme un Input, chevron en currentColor (aucun hex en CSS). */
export function Select({ className, children, ref, ...props }: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          'field-surface h-7 w-full appearance-none pl-2 pr-7',
          'text-[12px] text-foreground',
          'transition-[border-color] duration-150 ease-out',
          'hover:border-border-strong focus:border-foreground-muted',
          'aria-invalid:border-danger aria-invalid:hover:border-danger aria-invalid:focus:border-danger',
          'disabled:pointer-events-none disabled:opacity-40',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={11}
        strokeWidth={1.5}
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  )
}
