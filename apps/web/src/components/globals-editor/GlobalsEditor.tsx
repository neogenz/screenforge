import { useState } from 'react'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { FontPicker } from '@/components/text-editor/FontPicker'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import { CURRENT_DEVICE_FRAMES, getDeviceFrame } from '@/assets/device-frames'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { PropertyRow } from '@/components/patterns/property-row'
import { UnitField } from '@/components/patterns/unit-field'
import { SelectField } from '@/components/patterns/select-field'
import { SwatchButton } from '@/components/patterns/swatch-button'
import { Separator } from '@/components/ui/separator'
import { FONT_WEIGHT_OPTIONS } from '@/lib/fonts'
import type { GlobalSettings, DeviceModel } from '@/types'

export function GlobalsEditor() {
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const globals = useProjectStore((s) => s.project?.globals)

  if (!showGlobalsEditor || !globals) return null
  return <GlobalsEditorContent globals={globals} />
}

function GlobalsEditorContent({ globals }: { globals: GlobalSettings }) {
  const setShowGlobalsEditor = useUIStore((s) => s.setShowGlobalsEditor)
  const [draft, setDraft] = useState<GlobalSettings>(() => ({ ...globals }))

  const frame = getDeviceFrame(draft.deviceModel)
  const modelOptions = frame.current ? CURRENT_DEVICE_FRAMES : [frame, ...CURRENT_DEVICE_FRAMES]

  function update(partial: Partial<GlobalSettings>) {
    setDraft((previous) => ({ ...previous, ...partial }))
  }

  function handleClose() {
    setShowGlobalsEditor(false)
  }

  function handleSave() {
    useProjectStore.getState().updateGlobals(draft)
    handleClose()
  }

  function handleModelChange(deviceModel: DeviceModel) {
    const next = getDeviceFrame(deviceModel)
    update({ deviceModel, deviceColor: next.colors[0].name })
  }

  return (
    <DialogShell
      open
      onClose={handleClose}
      title="Réglages globaux"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          {/* « Enregistrer », pas « Appliquer à N écrans » : les réglages
              globaux n'écrivent que les défauts des calques à venir
              (`canvas.store.ts` les lit à la création) — les N écrans déjà
              composés n'en sont pas retouchés, et le dire changerait
              promettrait un geste que le bouton ne fait pas. */}
          <Button variant="default" onClick={handleSave}>
            Enregistrer les réglages par défaut
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Typographie */}
        <section>
          <h3 className="text-sm font-medium mb-2">Typographie</h3>
          {/* Contrôles d'une ligne, libellé en ligne (grammaire du panneau) :
              seul le composite — la pastille de couleur — passe par `PropertyRow`. */}
          <div className="flex flex-col gap-2">
            <FontPicker
              label="Police"
              value={draft.fontFamily}
              onChange={(fontFamily) => update({ fontFamily })}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <SelectField
                  label="Graisse"
                  aria-label="Graisse de police par défaut"
                  value={String(draft.fontWeight)}
                  onValueChange={(next) => update({ fontWeight: parseInt(next, 10) })}
                  items={FONT_WEIGHT_OPTIONS.map((weight) => ({
                    value: String(weight.value),
                    label: weight.label,
                  }))}
                />
              </div>
              <div className="w-28">
                <UnitField
                  label="Taille"
                  ariaLabel="Taille de police par défaut"
                  value={draft.fontSize}
                  min={8}
                  max={200}
                  onChange={(fontSize) => update({ fontSize })}
                />
              </div>
            </div>
            <PropertyRow label="Couleur" stacked>
              <ColorPicker
                value={draft.fontColor}
                onChange={(fontColor) => update({ fontColor })}
              />
            </PropertyRow>
          </div>
        </section>

        <Separator />

        {/* Arrière-plan */}
        <section>
          <h3 className="text-sm font-medium mb-2">Arrière-plan</h3>
          <BackgroundEditor
            background={draft.background}
            onChange={(background) => update({ background })}
          />
        </section>

        <Separator />

        {/* Appareil */}
        <section>
          <h3 className="text-sm font-medium mb-2">Appareil</h3>
          <div className="flex flex-col gap-2">
            <SelectField<DeviceModel>
              label="Modèle"
              aria-label="Modèle d’appareil par défaut"
              value={draft.deviceModel}
              onValueChange={handleModelChange}
              items={modelOptions.map((option) => ({
                value: option.model,
                label: `${option.modelName} · ${option.screenSize}`,
              }))}
            />
            <Field className="gap-1.5">
              <FieldLabel>Couleur</FieldLabel>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Couleur de l’appareil par défaut"
              >
                {frame.colors.map((color) => (
                  <SwatchButton
                    key={color.name}
                    color={color.frame}
                    selected={draft.deviceColor === color.name}
                    onClick={() => update({ deviceColor: color.name })}
                    tooltip={color.label}
                    aria-label={color.label}
                  />
                ))}
              </div>
            </Field>
          </div>
        </section>
      </div>
    </DialogShell>
  )
}
