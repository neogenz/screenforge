import { useState } from 'react'
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldScrubArea,
} from '@/components/ui/number-field'
import { roundTo } from '@/lib/number'
import { cn } from '@/lib/utils'

export interface UnitFieldProps {
  /** Préfixe court dans le champ, ex. « X ». C'est aussi la zone de scrub. */
  label?: string
  /** Nom accessible complet, ex. « Position X ». */
  ariaLabel: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  precision?: number
  /** Unité affichée après la valeur (px, °, %, ×). */
  unit?: string
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * Champ numérique coss : glisser le libellé ajuste (⇧ = ×10, ⌥ = ×0.1),
 * cliquer le champ focalise et laisse saisir. Le pointer handling est celui
 * de Base UI ; ici ne vit que la grammaire du panneau.
 */
export function UnitField({
  label,
  ariaLabel,
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 0,
  unit,
  disabled = false,
  className,
  id,
}: UnitFieldProps) {
  /* Le brouillon vit ici : un champ vidé avant d'être retapé vaut `null` le
     temps de la frappe, et renvoyer la valeur du projet à ce moment-là
     recollait « 60 » devant ce qu'on tape. Dérivé pendant le rendu, pas en
     effet. */
  const [draft, setDraft] = useState<number | null>(value)
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    setDraft(value)
  }
  return (
    <NumberField
      id={id}
      value={draft}
      onValueChange={(next) => {
        setDraft(next)
        if (next !== null && Number.isFinite(next)) onChange(roundTo(next, precision))
      }}
      min={min}
      max={max}
      step={step}
      largeStep={step * 10}
      smallStep={step / 10}
      format={{ maximumFractionDigits: precision, useGrouping: false }}
      disabled={disabled}
      data-slot="unit-field"
      className={cn('min-w-0 flex-1 flex-row items-center gap-1.5', className)}
    >
      {label && (
        <NumberFieldScrubArea
          label={label}
          direction="horizontal"
          className="shrink-0 select-none [&>label]:text-xs [&>label]:text-muted-foreground"
        />
      )}
      <NumberFieldGroup className="min-w-0 flex-1">
        <NumberFieldInput
          aria-label={ariaLabel}
          className="text-start"
          onBlur={() => {
            if (draft === null) setDraft(value)
          }}
        />
        {unit && (
          <span
            aria-hidden
            className="flex shrink-0 items-center pe-2 text-xs text-muted-foreground"
          >
            {unit}
          </span>
        )}
      </NumberFieldGroup>
    </NumberField>
  )
}
