import type { ReactNode } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip } from '@/components/ui/tooltip'
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
    <ToggleGroup
      type="single"
      aria-label={ariaLabel}
      value={value}
      onValueChange={(next) => onChange((next || value) as T)}
      disabled={disabled}
      className={cn('self-start', className)}
    >
      {options.map((option) => {
        /* L'infobulle ne sert qu'aux options sans libellé visible : répéter à
           la souris ce qui est déjà écrit est du bruit, pas une aide. */
        const hint = option.label ? undefined : option.ariaLabel
        const item = (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-pressed={option.value === value}
            aria-label={option.ariaLabel ?? option.label}
          >
            {option.icon}
            {option.label}
          </ToggleGroupItem>
        )
        return hint ? (
          <Tooltip key={option.value} content={hint}>
            {item}
          </Tooltip>
        ) : (
          item
        )
      })}
    </ToggleGroup>
  )
}
