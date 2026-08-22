import { useState } from 'react'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { FontPicker } from '@/components/text-editor/FontPicker'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import { deviceFrameOptionsFor, getDeviceFrame } from '@/assets/device-frames'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { PropertyRow } from '@/components/patterns/property-row'
import { UnitField } from '@/components/patterns/unit-field'
import { SelectField } from '@/components/patterns/select-field'
import { SwatchButton } from '@/components/patterns/swatch-button'
import { Separator } from '@/components/ui/separator'
import { FONT_WEIGHT_OPTIONS } from '@/lib/fonts'
import { getStoreTargetProfile } from '@/lib/dimensions'
import type { GlobalSettings, DeviceModel, StoreTargetId } from '@/types'

export function GlobalsEditor() {
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const project = useProjectStore((s) => s.project)

  if (!showGlobalsEditor || !project) return null
  return <GlobalsEditorContent globals={project.globals} target={project.target} />
}

function GlobalsEditorContent({
  globals,
  target,
}: {
  globals: GlobalSettings
  target: StoreTargetId
}) {
  const setShowGlobalsEditor = useUIStore((s) => s.setShowGlobalsEditor)
  const [draft, setDraft] = useState<GlobalSettings>(() => ({ ...globals }))
  const profile = getStoreTargetProfile(target)

  const modelOptions = deviceFrameOptionsFor(draft.deviceModel, profile.family)
  const frame = getDeviceFrame(draft.deviceModel)

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
        <section>
          <h3 className="section-title mb-2">Profil du projet</h3>
          <Card className="p-3">
            <p className="text-sm font-medium text-foreground">{profile.label}</p>
            <p className="mt-1 text-2xs text-muted-foreground tabular-nums">
              {profile.output.portrait.width}×{profile.output.portrait.height} px
              {profile.platform === 'apple' ? ` · ${profile.appStoreConnectType}` : ''}
            </p>
            <p className="mt-1 text-2xs text-muted-foreground">
              Immuable pour préserver les coordonnées et les releases de ce projet.
            </p>
          </Card>
        </section>

        <div className="hairline" />

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
