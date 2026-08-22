import { useId } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Segmented, type SegmentedOption } from '@/components/patterns/segmented'
import { SliderField } from '@/components/patterns/slider-field'
import { UnitFieldPair } from '@/components/patterns/unit-field'
import { Button } from '@/components/ui/button'
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
  const slotFieldId = useId()
  const placement = normalizeScreenshotPlacement(layer.placement)
  const measured = Boolean(layer.screenshotAssetId && layer.screenshotSize)

  const setPlacement = (updates: Partial<ScreenshotPlacement>, key: string) =>
    onUpdate(
      { placement: { ...placement, ...updates } },
      { coalesceKey: `layer:${layer.id}:${key}` },
    )

  return (
    <div className="flex flex-col gap-2">
      {/* `Label` et non `Field` : le champ porte un nom accessible plus long
          que son libellé visible, et l'`aria-labelledby` du Field l'écraserait. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={slotFieldId}>Rôle de l’écran</Label>
        <Input
          id={slotFieldId}
          value={layer.slot ?? ''}
          maxLength={MAX_SLOT_LENGTH}
          placeholder="budget, onboarding, reglages…"
          aria-label="Rôle de l’écran dans la campagne"
          /* Normalisé à la sortie du champ, pas à la frappe : couper les
             traits d'union pendant qu'on tape empêche d'écrire « mon-budget ». */
          onChange={(event) => onUpdate({ slot: event.target.value as string })}
          onBlur={(event) => onUpdate({ slot: normalizeSlot(event.target.value) })}
        />
      </div>

      {measured && (
        <>
          <Field className="gap-1.5">
            <FieldLabel>Cadrage</FieldLabel>
            <Segmented
              options={MODE_OPTIONS}
              value={placement.mode}
              onChange={(mode) => setPlacement({ mode }, 'placement-mode')}
              ariaLabel="Ajustement de la capture"
              className="w-full"
            />
          </Field>

          <SliderField
            label="Zoom"
            ariaLabel="Zoom de la capture"
            value={placement.zoom}
            min={MIN_SCREENSHOT_ZOOM}
            max={MAX_SCREENSHOT_ZOOM}
            step={0.05}
            formatValue={(value: number) => `${Math.round(value * 100)} %`}
            onChange={(zoom) => setPlacement({ zoom }, 'placement-zoom')}
          />
          <UnitFieldPair
            fields={[
              {
                label: 'X',
                ariaLabel: 'Point focal horizontal',
                unit: '%',
                min: 0,
                max: 100,
                value: Math.round(placement.focusX * 100),
                onChange: (v) => setPlacement({ focusX: v / 100 }, 'placement-focus-x'),
              },
              {
                label: 'Y',
                ariaLabel: 'Point focal vertical',
                unit: '%',
                min: 0,
                max: 100,
                value: Math.round(placement.focusY * 100),
                onChange: (v) => setPlacement({ focusY: v / 100 }, 'placement-focus-y'),
              },
            ]}
          />

          <Button
            variant="link"
            size="xs"
            className="field-label h-auto self-start px-0"
            onClick={() => onUpdate({ placement: { ...DEFAULT_SCREENSHOT_PLACEMENT } })}
          >
            Réinitialiser le cadrage
          </Button>
        </>
      )}
    </div>
  )
}
