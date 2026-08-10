import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import {
  DEFAULT_SCREENSHOT_PLACEMENT,
  MAX_SCREENSHOT_ZOOM,
  MIN_SCREENSHOT_ZOOM,
  normalizeScreenshotPlacement,
} from '@/lib/screenshot-placement'
import { MAX_SLOT_LENGTH, normalizeSlot } from '@/lib/slots'
import type { DeviceFrameLayer, ScreenshotFitMode, ScreenshotPlacement } from '@/types'

const MODE_OPTIONS: SegmentedOption<ScreenshotFitMode>[] = [
  { value: 'cover', label: 'Couvrir' },
  { value: 'contain', label: 'Contenir' },
  { value: 'fill', label: 'Étirer' },
]

interface ScreenshotFramingProps {
  layer: DeviceFrameLayer
  onUpdate: (updates: Partial<DeviceFrameLayer>, options?: { coalesceKey?: string }) => void
}

/**
 * Le rôle de l'écran, puis le cadrage de sa capture.
 *
 * Les deux vivent ensemble parce qu'ils ont la même raison d'être : survivre à
 * la release suivante. Le rôle dit où va la prochaine capture, le cadrage dit
 * comment elle s'y pose, et remplacer l'image ne touche ni l'un ni l'autre.
 *
 * Le rôle est saisi même sans capture — c'est l'appareil qui a un rôle, pas
 * l'image posée dedans, et l'ordre naturel est de composer la planche vide
 * avant de la remplir. Le cadrage, lui, n'apparaît qu'une fois la capture
 * mesurée : proposer un point focal que le rendu ne peut pas appliquer serait
 * un curseur qui ne fait rien.
 */
export function ScreenshotFraming({ layer, onUpdate }: ScreenshotFramingProps) {
  const placement = normalizeScreenshotPlacement(layer.placement)
  const measured = Boolean(layer.screenshotAssetId && layer.screenshotSize)

  const setPlacement = (updates: Partial<ScreenshotPlacement>, key: string) =>
    onUpdate(
      { placement: { ...placement, ...updates } },
      { coalesceKey: `layer:${layer.id}:${key}` },
    )

  return (
    <div className="flex flex-col gap-2">
      <Field label="Rôle de l’écran">
        <Input
          value={layer.slot ?? ''}
          maxLength={MAX_SLOT_LENGTH}
          placeholder="budget, onboarding, reglages…"
          aria-label="Rôle de l’écran dans la campagne"
          /* Normalisé à la sortie du champ, pas à la frappe : couper les
             traits d'union pendant qu'on tape empêche d'écrire « mon-budget ». */
          onChange={(event) => onUpdate({ slot: event.target.value as string })}
          onBlur={(event) => onUpdate({ slot: normalizeSlot(event.target.value) })}
        />
      </Field>

      {measured && (
        <>
          <Field label="Cadrage">
            <Segmented
              options={MODE_OPTIONS}
              value={placement.mode}
              onChange={(mode) => setPlacement({ mode }, 'placement-mode')}
              ariaLabel="Ajustement de la capture"
              className="w-full"
            />
          </Field>

          <Slider
            label="Zoom"
            ariaLabel="Zoom de la capture"
            value={placement.zoom}
            min={MIN_SCREENSHOT_ZOOM}
            max={MAX_SCREENSHOT_ZOOM}
            step={0.05}
            formatValue={(value: number) => `${Math.round(value * 100)} %`}
            onChange={(zoom) => setPlacement({ zoom }, 'placement-zoom')}
          />
          <Slider
            label="Point focal horizontal"
            ariaLabel="Point focal horizontal"
            value={placement.focusX}
            min={0}
            max={1}
            step={0.01}
            formatValue={(value: number) => `${Math.round(value * 100)} %`}
            onChange={(focusX) => setPlacement({ focusX }, 'placement-focus-x')}
          />
          <Slider
            label="Point focal vertical"
            ariaLabel="Point focal vertical"
            value={placement.focusY}
            min={0}
            max={1}
            step={0.01}
            formatValue={(value: number) => `${Math.round(value * 100)} %`}
            onChange={(focusY) => setPlacement({ focusY }, 'placement-focus-y')}
          />

          <button
            type="button"
            className="field-label self-start underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => onUpdate({ placement: { ...DEFAULT_SCREENSHOT_PLACEMENT } })}
          >
            Réinitialiser le cadrage
          </button>
        </>
      )}
    </div>
  )
}
