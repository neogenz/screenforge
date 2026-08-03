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
  disabled?: boolean
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  disabled = false,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-stretch gap-0.5 rounded-md border border-border bg-inset p-[3px]',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={option.ariaLabel ?? option.label}
            title={option.ariaLabel ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              // Rayon intérieur = rayon du groupe (9) moins la marge (3).
              'inline-flex h-8 items-center justify-center gap-1 rounded-sm px-2.5',
              'font-sans text-[11.5px] font-medium',
              'transition-[background,color] duration-150 ease-out',
              'disabled:pointer-events-none disabled:opacity-40',
              // L'option active monte d'un palier : lisible sur panneau clair comme sombre,
              // là où une bordure claire seule disparaissait en thème clair.
              active
                ? 'bg-raised text-foreground shadow-(--hairline-top)'
                : 'text-foreground-muted hover:bg-raised-hover hover:text-foreground',
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
