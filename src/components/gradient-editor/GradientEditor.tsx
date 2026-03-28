import { Plus, Trash2 } from 'lucide-react'
import type { GradientFill, ColorStop } from '@/types'
import { cn } from '@/lib/utils'
import { ColorPicker } from '@/components/color-picker/ColorPicker'

interface GradientEditorProps {
  value: GradientFill
  onChange: (gradient: GradientFill) => void
}

const inputCls = cn(
  'h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-sm',
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
)

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
    .sort((a: ColorStop & { originalIndex: number }, b: ColorStop & { originalIndex: number }) => a.offset - b.offset)

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Forme</span>
        <div className="flex gap-2">
          {(['linear', 'radial'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'h-10 min-w-0 flex-1 rounded-xl border px-4 text-sm font-medium capitalize transition-colors',
                value.type === t
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-border bg-surface text-foreground hover:border-muted hover:bg-surface-hover',
              )}
            >
              {t === 'linear' ? 'Linéaire' : 'Radial'}
            </button>
          ))}
        </div>
      </div>

      {value.type === 'linear' && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Angle</span>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={359}
              value={value.angle ?? 90}
              onChange={(e) => setAngle(parseInt(e.target.value, 10) || 0)}
              className={cn(inputCls, 'w-24 tabular-nums')}
              aria-label="Angle du dégradé en degrés"
            />
            <span className="text-sm text-muted">degrés</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Aperçu</span>
        <div
          className="h-10 w-full rounded-xl border border-border shadow-inner"
          style={{ background: buildCssGradient(value) }}
          aria-hidden="true"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="min-w-0 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Points de couleur ({value.stops.length}/10)
          </span>
          <button
            type="button"
            onClick={addStop}
            disabled={value.stops.length >= 10}
            className={cn(
              'inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors sm:w-auto sm:justify-center',
              'border-border bg-surface text-foreground hover:border-muted hover:bg-surface-hover',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
            aria-label="Ajouter un point de couleur"
          >
            <Plus size={16} strokeWidth={2} />
            Ajouter
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {sortedStops.map((stop) => (
            <div
              key={stop.originalIndex}
              className="min-w-0 max-w-full rounded-xl border border-border/80 bg-background/40 p-3 shadow-sm sm:p-4"
            >
              <ColorPicker
                value={stop.color}
                onChange={(color) => updateStop(stop.originalIndex, { color })}
                showOpacity
              />
              <div className="mt-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Position</span>
                  <div className="flex items-center gap-2">
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
                      className={cn(inputCls, 'w-28 tabular-nums')}
                      aria-label="Position du point sur le dégradé"
                    />
                    <span className="text-xs text-muted">(0–1)</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeStop(stop.originalIndex)}
                  disabled={value.stops.length <= 2}
                  className={cn(
                    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                    'border-border bg-surface text-muted hover:border-danger hover:text-danger',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                  aria-label="Supprimer ce point"
                >
                  <Trash2 size={18} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
