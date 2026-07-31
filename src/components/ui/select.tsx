import { ChevronDown } from 'lucide-react'
import type { Ref, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>
}

/** Native select dressed as an Input, chevron via currentColor (no hex in CSS). */
export function Select({ className, children, ref, ...props }: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          'h-7 w-full appearance-none rounded-md border border-border bg-surface pl-2 pr-7 outline-none',
          'font-sans text-[12px] text-foreground',
          'transition-[border-color,background] duration-150 ease-out',
          'hover:border-border-strong focus:border-foreground-muted',
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
