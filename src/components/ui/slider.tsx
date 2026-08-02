import type { CSSProperties, Ref } from 'react'
import { clampNumber } from '@/lib/number'
import { cn } from '@/lib/utils'

export interface SliderProps {
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
  ref?: Ref<HTMLInputElement>
}

/** Hairline slider with filled track and tabular readout. */
export function Slider({
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
  const fill = ((clampNumber(value, min, max) - min) / (max - min)) * 100
  return (
    <div className={cn('flex h-7 items-center gap-2', disabled && 'pointer-events-none opacity-40', className)}>
      <input
        ref={ref}
        type="range"
        aria-label={ariaLabel}
        aria-valuetext={formatValue ? formatValue(value) : String(value)}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        className="flex-1"
      />
      <span className="tabular w-9 shrink-0 text-right text-[11px] text-foreground-muted">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  )
}
