import { useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { GradientFill, ColorStop } from '@/types'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { Button } from '@/components/ui/button'
import { AngleControl } from '@/components/patterns/angle-control'
import { IconButton } from '@/components/patterns/icon-button'
import { UnitField } from '@/components/patterns/unit-field'
import { Segmented } from '@/components/patterns/segmented'
import type { SegmentedOption } from '@/components/patterns/segmented'
import { DEFAULT_STOP_COLOR } from '@/lib/content-defaults'

interface GradientEditorProps {
  value: GradientFill
  onChange: (gradient: GradientFill, coalesceKey?: string) => void
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

  function setAngle(angle: number, continuous = false) {
    const finiteAngle = Number.isFinite(angle) ? angle : 0
    onChange(
      { ...value, angle: ((finiteAngle % 360) + 360) % 360 },
      continuous ? 'angle' : undefined,
    )
  }

  function setCenter(axis: 'centerX' | 'centerY', percentage: number) {
    const finitePercentage = Number.isFinite(percentage) ? percentage : 50
    onChange(
      {
        ...value,
        [axis]: Math.min(100, Math.max(0, finitePercentage)),
      },
      axis,
    )
  }

  function updateStop(index: number, partial: Partial<ColorStop>, property: 'color' | 'offset') {
    const stops = value.stops.map((s: ColorStop, i: number) =>
      i === index ? { ...s, ...partial } : s,
    )
    onChange({ ...value, stops }, `stop:${index}:${property}`)
  }

  function addStop() {
    if (value.stops.length >= 10) return
    const sorted = value.stops.slice().sort((a: ColorStop, b: ColorStop) => a.offset - b.offset)
    if (sorted.length < 2) {
      onChange({ ...value, stops: [...value.stops, { offset: 1, color: DEFAULT_STOP_COLOR }] })
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
      (a: ColorStop & { originalIndex: number }, b: ColorStop & { originalIndex: number }) =>
        a.offset - b.offset,
    )

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4">
      {/* Type */}
      <div className="flex flex-col gap-2">
        <span className="field-label">Type</span>
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
        <AngleControl ariaLabel="Angle du dégradé" value={value.angle ?? 90} onChange={setAngle} />
      )}

      {/* Center (radial only) */}
      {value.type === 'radial' && (
        <div className="flex gap-2">
          <UnitField
            label="X"
            ariaLabel="Centre X du dégradé"
            min={0}
            max={100}
            value={Math.round(value.centerX ?? 50)}
            onChange={(v) => setCenter('centerX', v)}
          />
          <UnitField
            label="Y"
            ariaLabel="Centre Y du dégradé"
            min={0}
            max={100}
            value={Math.round(value.centerY ?? 50)}
            onChange={(v) => setCenter('centerY', v)}
          />
        </div>
      )}

      {/* La piste est à la fois l'aperçu et le contrôle : deux blocs séparés
          faisaient saisir au chiffre une position qui se voit à l'œil. */}
      <StopTrack
        gradient={value}
        stops={sortedStops}
        onMove={(index, offset) => updateStop(index, { offset }, 'offset')}
      />

      {/* Stops */}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="field-label">
            Arrêts <span className="tabular">{value.stops.length}/10</span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {sortedStops.map((stop, displayIndex) => (
            <div
              key={stop.originalIndex}
              className="flex min-w-0 max-w-full flex-col gap-2 rounded-md border border-border bg-muted p-2"
            >
              <ColorPicker
                value={stop.color}
                onChange={(color) => updateStop(stop.originalIndex, { color }, 'color')}
                showOpacity
              />
              <div className="flex items-center gap-2">
                <UnitField
                  label="Position"
                  ariaLabel={`Position de l’arrêt ${displayIndex + 1}`}
                  unit="%"
                  min={0}
                  max={100}
                  value={Math.round(stop.offset * 100)}
                  onChange={(v) => updateStop(stop.originalIndex, { offset: v / 100 }, 'offset')}
                  className="flex-1"
                />
                <IconButton
                  size="sm"
                  onClick={() => removeStop(stop.originalIndex)}
                  disabled={value.stops.length <= 2}
                  aria-label="Supprimer le stop"
                  className="shrink-0 hover:bg-destructive/14 hover:text-destructive"
                >
                  <Trash2 size={13} strokeWidth={1.5} aria-hidden />
                </IconButton>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={addStop}
          disabled={value.stops.length >= 10}
          className="w-full"
        >
          <Plus size={13} strokeWidth={1.75} aria-hidden />
          Ajouter un stop
        </Button>
      </div>
    </div>
  )
}

/** Pas de pas : la souris place au pixel, seul le clavier a besoin d'un cran. */
const KEY_STEP = 0.01
const KEY_STEP_COARSE = 0.1

interface StopTrackProps {
  gradient: GradientFill
  stops: (ColorStop & { originalIndex: number })[]
  onMove: (index: number, offset: number) => void
}

/**
 * Piste du dégradé : la bande montre le résultat, les pastilles portent les
 * arrêts. La souris fait le geste, les flèches donnent la précision.
 */
function StopTrack({ gradient, stops, onMove }: StopTrackProps) {
  const track = useRef<HTMLDivElement>(null)

  function offsetAt(clientX: number): number {
    const bounds = track.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0) return 0
    return Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width))
  }

  function handlePointerDown(index: number, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const move = (pointer: PointerEvent) => onMove(index, offsetAt(pointer.clientX))
    const release = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
  }

  function handleKeyDown(index: number, offset: number, event: React.KeyboardEvent) {
    if (event.key === 'Home' || event.key === 'End') {
      // Comme un slider natif : Home et End vont aux bornes de la plage.
      event.preventDefault()
      onMove(index, event.key === 'Home' ? 0 : 1)
      return
    }
    const step = event.shiftKey ? KEY_STEP_COARSE : KEY_STEP
    const delta = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
    if (delta === 0) return
    event.preventDefault()
    onMove(index, Math.min(1, Math.max(0, offset + delta)))
  }

  return (
    <div
      ref={track}
      // La bande porte le damier : sans lui un arrêt transparent est indiscernable
      // d'un arrêt blanc, et c'est justement ce qu'on vient régler.
      className="checkerboard relative h-9 w-full rounded-md border border-border"
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-md"
        style={{ background: buildCssGradient(gradient) }}
      />
      {stops.map((stop, displayIndex) => (
        <Button
          key={stop.originalIndex}
          variant="ghost"
          role="slider"
          aria-label={`Position de l’arrêt ${displayIndex + 1}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(stop.offset * 100)}
          aria-valuetext={`${Math.round(stop.offset * 100)} %`}
          onPointerDown={(event) => handlePointerDown(stop.originalIndex, event)}
          onKeyDown={(event) => handleKeyDown(stop.originalIndex, stop.offset, event)}
          style={{ left: `${stop.offset * 100}%`, background: stop.color }}
          // `hit-24` : la poignée reste à 18px — c'est la piste qui doit rester
          // lisible — mais la prise atteint le minimum de la 2.5.8. La piste ne
          // déplace pas les arrêts, donc c'est bien ce bouton qui est la cible.
          // `border-white` ne suit pas le thème, et c'est voulu : l'arrêt se
          // pose sur le dégradé de l'utilisateur, pas sur une surface de chrome.
          // Un anneau thématisé disparaîtrait sur un dégradé sombre en thème
          // sombre. Même raison que `SELECTION_INK` sur le canevas.
          className="hit-24 absolute top-1/2 h-4.5 w-4.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize
            rounded-full border-2 border-white p-0 shadow-(--shadow-handle) sm:h-4.5
            transition-transform duration-100 ease-out hover:scale-110 active:scale-110"
        />
      ))}
    </div>
  )
}
