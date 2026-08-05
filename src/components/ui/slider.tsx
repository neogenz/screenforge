import type { Ref } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { clampNumber } from '@/lib/number'
import { cn } from '@/lib/utils'

export interface SliderProps {
  /**
   * Libellé visible, posé au-dessus de la piste.
   *
   * Optionnel parce qu'un curseur posé dans une rangée — l'alpha à côté de sa
   * pastille et de son hexadécimal — se nomme par son voisinage. Seul en
   * colonne il ne se nomme plus : `ariaLabel` renseignait alors le lecteur
   * d'écran et laissait l'œil deviner.
   */
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
  ref?: Ref<HTMLSpanElement>
}

/** Slider with a filled track, a clear grab handle and a tabular readout. */
export function Slider({
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
  ref,
}: SliderProps) {
  const current = clampNumber(value, min, max)
  const track = (
    <div className={cn('flex h-8 items-center gap-2', disabled && 'pointer-events-none opacity-40', !label && className)}>
      <SliderPrimitive.Root
        value={[current]}
        onValueChange={(values) => onChange(values[0] ?? current)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="relative flex h-full min-w-0 flex-1 touch-none items-center select-none"
      >
        <SliderPrimitive.Track className="relative h-2 grow overflow-hidden rounded-full border border-border bg-muted shadow-(--shadow-inset)">
          <SliderPrimitive.Range className="absolute h-full bg-muted-foreground" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          ref={ref}
          aria-label={ariaLabel}
          aria-valuetext={formatValue ? formatValue(current) : String(current)}
          aria-disabled={disabled || undefined}
          className={cn(
            'block h-3.5 w-3.5 cursor-pointer rounded-full border-2 border-card bg-foreground shadow-(--shadow-handle) outline-none',
            'transition-[transform,box-shadow] duration-120 ease-out',
            'hover:scale-115 focus-visible:scale-115 active:scale-115',
            'focus-visible:shadow-(--shadow-handle-focus) active:shadow-(--shadow-handle-focus)',
          )}
        />
      </SliderPrimitive.Root>
      <span className="field-surface tabular flex h-8 min-w-11 shrink-0 items-center justify-center px-2 text-2xs text-muted-foreground">
        {formatValue ? formatValue(current) : current}
      </span>
    </div>
  )

  if (!label) return track

  // Même grammaire que `AngleControl` : l'écart de 6 lie l'étiquette au contrôle.
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="field-label">{label}</span>
      {track}
    </div>
  )
}
