import { useId } from 'react'
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
  /**
   * Libellé visible posé à gauche du groupe.
   *
   * Un segmenté seul en tête de panneau se lit comme une barre d'onglets : on
   * y voit deux vues du panneau, pas deux valeurs d'une propriété. Le mot est
   * ce qui fait la différence, et il est le nom accessible du groupe — pas un
   * doublon de `ariaLabel`, qui devient inutile dès qu'il est écrit.
   */
  label?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

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
      type="single"
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? labelId : undefined}
      value={value}
      onValueChange={(next) => onChange((next || value) as T)}
      disabled={disabled}
      className={cn('self-start', !label && className)}
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

  if (!label) return group

  // Même grammaire que `Select` : un contrôle d'une ligne porte son libellé à
  // côté, et l'écart de 6 est celui qui lie une étiquette à son contrôle.
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span id={labelId} className="field-label shrink-0 select-none">
        {label}
      </span>
      {group}
    </div>
  )
}
