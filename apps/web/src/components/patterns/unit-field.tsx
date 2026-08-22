import { useEffect, useRef, useState } from 'react'
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
  /* La borne tapée : Base UI clampe déjà `onValueChange` en continu (pas
     seulement au blur), donc la valeur validée ne dit jamais elle-même
     qu'elle a été ramenée — seul le texte brut du champ le sait encore.
     ponytail : lue sur `raw === bound` plutôt que sur un delta avant/après,
     donc taper exactement la borne l'affiche aussi ; distinguer les deux
     demanderait la valeur non clampée que Base UI ne remonte pas. */
  const [bound, setBound] = useState<number | null>(null)
  const boundTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(boundTimer.current), [])
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
      className={cn('relative min-w-0 flex-1 flex-row items-center gap-1.5', className)}
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
          onChange={(event) => {
            const raw = Number(event.currentTarget.value)
            if (!Number.isFinite(raw)) return
            const hit =
              min !== undefined && raw < min ? min : max !== undefined && raw > max ? max : null
            if (hit === null) return
            setBound(hit)
            window.clearTimeout(boundTimer.current)
            boundTimer.current = window.setTimeout(() => setBound(null), 1000)
          }}
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
      {bound !== null && (
        <p className="absolute inset-x-0 top-full z-10 mt-1 truncate text-xs text-muted-foreground">
          {bound === min ? 'Min. ' : 'Max. '}
          {bound}
          {unit}
        </p>
      )}
    </NumberField>
  )
}

/**
 * Deux champs sur une ligne — X/Y, L/H. Une grille à deux colonnes et non un
 * `InputGroup` partagé : chaque champ garde son scrub et son unité.
 */
// ponytail: grille de deux UnitField ; un InputGroup commun si la ligne manque de place.
export function UnitFieldPair({
  fields,
  className,
}: {
  fields: [UnitFieldProps, UnitFieldProps]
  className?: string
}) {
  return (
    <div data-slot="unit-field-pair" className={cn('grid grid-cols-2 gap-2', className)}>
      <UnitField {...fields[0]} />
      <UnitField {...fields[1]} />
    </div>
  )
}
