import { useRef, useState } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipPopup } from '@/components/ui/tooltip'
import { clampNumber } from '@/lib/number'
import { cn } from '@/lib/utils'

export interface SliderFieldProps {
  /** Libellé visible au-dessus de la piste ; un curseur posé dans une rangée se nomme par son voisinage. */
  label?: string
  ariaLabel: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Formats the readout on the right. Defaults to the raw value. */
  formatValue?: (value: number) => string
  disabled?: boolean
  className?: string
}

/**
 * Slider coss avec lecture tabulaire à droite. Le nom accessible passe par le
 * `Field` : c'est de lui que Base UI tire l'`aria-labelledby` du curseur, le
 * `Slider` coss n'exposant pas `getAriaLabel`.
 */
export function SliderField({
  label,
  ariaLabel,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue,
  disabled = false,
  className,
}: SliderFieldProps) {
  const current = clampNumber(value, min, max)
  const readout = formatValue ? formatValue(current) : String(current)
  /* Pas de lecture de `[data-dragging]` : coss ne l'expose que sur le curseur
     lui-même (`ui/slider.tsx`, jamais retouché), pointeur pressé/relâché en
     donne le même instant sans y toucher — la capture du pointeur par le
     curseur laisse `pointerup` remonter jusqu'ici. */
  const [dragging, setDragging] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const track = (
    <div data-slot="slider-field" className="flex h-8 w-full items-center gap-2">
      <div
        ref={anchorRef}
        className="relative min-w-0 flex-1"
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <Slider
          value={current}
          onValueChange={(next) => onChange(typeof next === 'number' ? next : (next[0] ?? current))}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          // Le `Control` coss impose `min-w-44` : dans une rangée étroite il
          // passe sous le champ voisin au lieu de rétrécir.
          className="*:data-[slot=slider-control]:min-w-0"
        />
        <Tooltip open={dragging}>
          <TooltipPopup anchor={anchorRef} side="top">
            {readout}
          </TooltipPopup>
        </Tooltip>
      </div>
      <span className="min-w-11 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
        {readout}
      </span>
    </div>
  )

  return (
    // Le `className` vise l'enveloppe : un `flex-1` posé plus bas laisserait le
    // `Field` à sa largeur de contenu, et le curseur à deux pixels.
    <Field className={cn('items-stretch gap-1.5', className)}>
      {/* `aria-label` sur le libellé : `aria-labelledby` le lit avant le texte,
          donc le curseur s'annonce « Zoom de la capture » sous un « Zoom » visible. */}
      <FieldLabel className={cn(!label && 'sr-only')} aria-label={ariaLabel}>
        {label ?? ariaLabel}
      </FieldLabel>
      {track}
    </Field>
  )
}
