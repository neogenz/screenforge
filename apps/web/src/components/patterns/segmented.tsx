import { useId } from 'react'
import type { ReactNode } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Hint } from '@/components/patterns/hint'
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
  /**
   * Libellé visible à gauche du groupe : sans lui, un segmenté seul en tête de
   * panneau se lit comme une barre d'onglets. C'est le nom accessible du groupe.
   */
  label?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

/** Choix exclusif : `ToggleGroup` coss `outline`, une valeur toujours tenue. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  className,
  disabled = false,
}: SegmentedProps<T>) {
  const labelId = useId()
  const group = (
    <ToggleGroup
      variant="outline"
      size="sm"
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? labelId : undefined}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0] as T | undefined
        if (picked !== undefined) onChange(picked)
      }}
      disabled={disabled}
      data-slot="segmented"
      className={cn('self-start', !label && className)}
    >
      {options.map((option) => {
        /* L'infobulle ne sert qu'aux options sans libellé visible. */
        const hint = option.label ? undefined : option.ariaLabel
        const item = (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.ariaLabel ?? option.label}
          >
            {option.icon}
            {option.label}
          </ToggleGroupItem>
        )
        return hint ? (
          <Hint key={option.value} content={hint}>
            {item}
          </Hint>
        ) : (
          item
        )
      })}
    </ToggleGroup>
  )

  if (!label) return group

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span id={labelId} className="shrink-0 select-none text-xs text-muted-foreground">
        {label}
      </span>
      {group}
    </div>
  )
}
