import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label?: string
  icon?: ReactNode
  ariaLabel?: string
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-stretch gap-0.5 rounded-lg border border-border bg-inset p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={option.ariaLabel ?? option.label}
            title={option.ariaLabel ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-6 items-center justify-center gap-1 rounded-md px-2 outline-none',
              'font-sans text-[11px] font-medium',
              'transition-[background,color] duration-150 ease-out',
              active
                ? 'border border-border bg-raised text-foreground'
                : 'border border-transparent text-faint hover:text-foreground',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
