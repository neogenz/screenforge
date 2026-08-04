import type { Ref } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
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
  ref?: Ref<HTMLSpanElement>
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
  const current = clampNumber(value, min, max)
  return (
    <div className={cn('flex h-7 items-center gap-2', disabled && 'pointer-events-none opacity-40', className)}>
      <SliderPrimitive.Root
        value={[current]}
        onValueChange={(values) => onChange(values[0] ?? current)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="relative flex h-full min-w-0 flex-1 touch-none items-center select-none"
      >
        <SliderPrimitive.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-border">
          <SliderPrimitive.Range className="absolute h-full bg-foreground-muted" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          ref={ref}
          aria-label={ariaLabel}
          aria-valuetext={formatValue ? formatValue(current) : String(current)}
          aria-disabled={disabled || undefined}
          className={cn(
            'block h-[11px] w-[11px] cursor-pointer rounded-full border-2 border-panel bg-foreground outline-none',
            'transition-[transform,box-shadow] duration-120 ease-out',
            'hover:scale-115 focus-visible:scale-115 active:scale-115',
            'focus-visible:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-foreground)_16%,transparent)]',
            'active:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-foreground)_16%,transparent)]',
          )}
        />
      </SliderPrimitive.Root>
      <span className="tabular w-9 shrink-0 text-right text-[11px] text-foreground-muted">
        {formatValue ? formatValue(current) : current}
      </span>
    </div>
  )
}
