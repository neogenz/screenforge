import { Plus, Trash2 } from 'lucide-react'
import type { GradientFill, ColorStop } from '@/types'
import { cn } from '@/lib/utils'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { inputCls } from '@/components/properties-panel/TransformSection'

interface GradientEditorProps {
  value: GradientFill
  onChange: (gradient: GradientFill) => void
}

function buildCssGradient(gradient: GradientFill): string {
  const stops = gradient.stops
    .slice()
    .sort((a: ColorStop, b: ColorStop) => a.offset - b.offset)
    .map((s: ColorStop) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ')

  if (gradient.type === 'radial') {
    return `radial-gradient(circle, ${stops})`
  }
  const angle = gradient.angle ?? 90
  return `linear-gradient(${angle}deg, ${stops})`
}

export function GradientEditor({ value, onChange }: GradientEditorProps) {
  function setType(type: 'linear' | 'radial') {
    onChange({ ...value, type })
  }

  function setAngle(angle: number) {
    onChange({ ...value, angle: ((angle % 360) + 360) % 360 })
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
      {/* Type — flat segmented */}
      <div className="flex flex-col gap-2">
        <span className="mono-label">Type</span>
        <div className="seg w-full">
          {(['linear', 'radial'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              data-active={value.type === t}
              className="seg-btn flex-1"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Angle (linear only) */}
      {value.type === 'linear' && (
        <div className="flex flex-col gap-2">
          <span className="mono-label">Angle</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={359}
              value={value.angle ?? 90}
              onChange={(e) => setAngle(parseInt(e.target.value, 10) || 0)}
              className={cn(inputCls, 'w-20')}
              aria-label="Gradient angle in degrees"
            />
            <span className="mono-label">deg</span>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="flex flex-col gap-2">
        <span className="mono-label">Preview</span>
        <div
          className="h-10 w-full rounded-md border border-border"
          style={{ background: buildCssGradient(value) }}
          aria-hidden="true"
        />
      </div>

      {/* Stops */}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label">
            Stops <span className="mono-value">{value.stops.length}/10</span>
          </span>
          <button
            type="button"
            onClick={addStop}
            disabled={value.stops.length >= 10}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-sm text-foreground-muted',
              'transition-colors duration-100 ease-out',
              'hover:bg-surface-hover hover:text-foreground',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
            aria-label="Add color stop"
          >
            <Plus size={12} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {sortedStops.map((stop) => (
            <div
              key={stop.originalIndex}
              className="flex min-w-0 max-w-full flex-col gap-2 rounded-md border border-border bg-panel-sub p-2.5"
            >
              <ColorPicker
                value={stop.color}
                onChange={(color) => updateStop(stop.originalIndex, { color })}
                showOpacity
              />
              <div className="flex min-w-0 items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="mono-label">Pos</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={stop.offset}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v)) {
                        updateStop(stop.originalIndex, { offset: Math.max(0, Math.min(1, v)) })
                      }
                    }}
                    className={cn(inputCls, 'w-full')}
                    aria-label="Stop position"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeStop(stop.originalIndex)}
                  disabled={value.stops.length <= 2}
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border text-foreground-muted',
                    'transition-colors duration-100 ease-out',
                    'hover:border-danger hover:text-danger',
                    'disabled:pointer-events-none disabled:opacity-40',
                  )}
                  aria-label="Remove stop"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
