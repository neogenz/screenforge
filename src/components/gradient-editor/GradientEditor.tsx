import { Plus, Trash2 } from 'lucide-react'
import type { GradientFill, ColorStop } from '@/types'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { NumberField } from '@/components/ui/number-field'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'

interface GradientEditorProps {
  value: GradientFill
  onChange: (gradient: GradientFill) => void
}

type GradientType = GradientFill['type']

const TYPE_OPTIONS: SegmentedOption<GradientType>[] = [
  { value: 'linear', label: 'Linéaire' },
  { value: 'radial', label: 'Radial' },
]

function buildCssGradient(gradient: GradientFill): string {
  const stops = gradient.stops
    .slice()
    .sort((a: ColorStop, b: ColorStop) => a.offset - b.offset)
    .map((s: ColorStop) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ')

  if (gradient.type === 'radial') {
    return `radial-gradient(circle at ${gradient.centerX ?? 50}% ${gradient.centerY ?? 50}%, ${stops})`
  }
  const angle = gradient.angle ?? 90
  return `linear-gradient(${angle}deg, ${stops})`
}

export function GradientEditor({ value, onChange }: GradientEditorProps) {
  function setType(type: GradientType) {
    onChange({ ...value, type })
  }

  function setAngle(angle: number) {
    const finiteAngle = Number.isFinite(angle) ? angle : 0
    onChange({ ...value, angle: ((finiteAngle % 360) + 360) % 360 })
  }

  function setCenter(axis: 'centerX' | 'centerY', percentage: number) {
    const finitePercentage = Number.isFinite(percentage) ? percentage : 50
    onChange({
      ...value,
      [axis]: Math.min(100, Math.max(0, finitePercentage)),
    })
  }

  function updateStop(index: number, partial: Partial<ColorStop>) {
    const stops = value.stops.map((s: ColorStop, i: number) =>
      i === index ? { ...s, ...partial } : s,
    )
    onChange({ ...value, stops })
  }

  function addStop() {
    if (value.stops.length >= 10) return
    const sorted = value.stops.slice().sort((a: ColorStop, b: ColorStop) => a.offset - b.offset)
    if (sorted.length < 2) {
      onChange({ ...value, stops: [...value.stops, { offset: 1, color: '#ffffff' }] })
      return
    }
    const last = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const newOffset = Math.round(((prev.offset + last.offset) / 2) * 100) / 100
    const newStop: ColorStop = { offset: newOffset, color: prev.color }
    onChange({ ...value, stops: [...value.stops, newStop] })
  }

  function removeStop(index: number) {
    if (value.stops.length <= 2) return
    const stops = value.stops.filter((_: ColorStop, i: number) => i !== index)
    onChange({ ...value, stops })
  }

  const sortedStops = value.stops
    .map((s: ColorStop, originalIndex: number) => ({ ...s, originalIndex }))
    .sort(
      (
        a: ColorStop & { originalIndex: number },
        b: ColorStop & { originalIndex: number },
      ) => a.offset - b.offset,
    )

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4">
      {/* Type */}
      <div className="flex flex-col gap-2">
        <span className="mono-label">Type</span>
        <Segmented
          options={TYPE_OPTIONS}
          value={value.type}
          onChange={setType}
          ariaLabel="Type de dégradé"
          className="w-full [&>button]:flex-1"
        />
      </div>

      {/* Angle (linear only) */}
      {value.type === 'linear' && (
        <NumberField
          label="Angle"
          ariaLabel="Angle du dégradé"
          min={0}
          max={360}
          step={1}
          value={value.angle ?? 90}
          onChange={setAngle}
        />
      )}

      {/* Center (radial only) */}
      {value.type === 'radial' && (
        <div className="flex gap-2">
          <NumberField
            label="X"
            ariaLabel="Centre X du dégradé"
            min={0}
            max={100}
            value={Math.round(value.centerX ?? 50)}
            onChange={(v) => setCenter('centerX', v)}
          />
          <NumberField
            label="Y"
            ariaLabel="Centre Y du dégradé"
            min={0}
            max={100}
            value={Math.round(value.centerY ?? 50)}
            onChange={(v) => setCenter('centerY', v)}
          />
        </div>
      )}

      {/* Preview */}
      <div className="flex flex-col gap-2">
        <span className="mono-label">Aperçu</span>
        <div
          className="h-8 w-full rounded-md border border-border"
          style={{ background: buildCssGradient(value) }}
          aria-hidden="true"
        />
      </div>

      {/* Stops */}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label">
            Arrêts <span className="mono-value">{value.stops.length}/10</span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {sortedStops.map((stop, displayIndex) => (
            <div
              key={stop.originalIndex}
              className="flex min-w-0 max-w-full flex-col gap-2 rounded-md border border-border bg-panel-sub p-2"
            >
              <ColorPicker
                value={stop.color}
                onChange={(color) => updateStop(stop.originalIndex, { color })}
                showOpacity
              />
              <div className="flex min-w-0 items-center gap-2">
                <NumberField
                  label="Pos"
                  ariaLabel={`Position du stop ${displayIndex + 1}`}
                  min={0}
                  max={100}
                  value={Math.round(stop.offset * 100)}
                  onChange={(v) => updateStop(stop.originalIndex, { offset: v / 100 })}
                />
                <IconButton
                  size="sm"
                  onClick={() => removeStop(stop.originalIndex)}
                  disabled={value.stops.length <= 2}
                  aria-label="Supprimer le stop"
                  className="shrink-0 hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={12} strokeWidth={1.5} aria-hidden />
                </IconButton>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={addStop}
          disabled={value.stops.length >= 10}
          className="w-full"
        >
          <Plus size={12} strokeWidth={1.75} aria-hidden />
          Ajouter un stop
        </Button>
      </div>
    </div>
  )
}
