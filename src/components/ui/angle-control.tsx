import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const ANGLE_PRESETS = ['0', '90', '180', '270'] as const
type AnglePreset = typeof ANGLE_PRESETS[number]

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
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="field-label">{label}</span>
      <Slider
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
        className="w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-1.5"
      />
    </div>
  )
}
