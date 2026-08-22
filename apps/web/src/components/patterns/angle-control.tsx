import { Segmented, type SegmentedOption } from '@/components/patterns/segmented'
import { SliderField } from '@/components/patterns/slider-field'
import { cn } from '@/lib/utils'

const ANGLE_PRESETS = ['0', '90', '180', '270'] as const
type AnglePreset = (typeof ANGLE_PRESETS)[number]

const PRESET_OPTIONS: SegmentedOption<AnglePreset>[] = ANGLE_PRESETS.map((angle) => ({
  value: angle,
  label: `${angle}°`,
}))

interface AngleControlProps {
  label?: string
  ariaLabel: string
  value: number
  onChange: (value: number, continuous?: boolean) => void
  disabled?: boolean
  className?: string
}

/** Slider angulaire précis, complété par les quatre directions cardinales. */
export function AngleControl({
  label = 'Angle',
  ariaLabel,
  value,
  onChange,
  disabled = false,
  className,
}: AngleControlProps) {
  const normalized = Math.round(((value % 360) + 360) % 360)

  return (
    <div data-slot="angle-control" className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <SliderField
        ariaLabel={ariaLabel}
        min={0}
        max={359}
        step={1}
        value={normalized}
        onChange={(angle) => onChange(angle, true)}
        disabled={disabled}
        formatValue={(angle) => `${Math.round(angle)}°`}
      />
      <Segmented
        options={PRESET_OPTIONS}
        value={String(normalized) as AnglePreset}
        onChange={(angle) => onChange(Number(angle))}
        ariaLabel={`${ariaLabel} — angles principaux`}
        disabled={disabled}
        className="w-full *:min-w-0 *:flex-1 *:px-1.5"
      />
    </div>
  )
}
