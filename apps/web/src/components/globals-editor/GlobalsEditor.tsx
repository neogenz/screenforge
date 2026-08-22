import { useState } from 'react'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { FontPicker } from '@/components/text-editor/FontPicker'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import { deviceFrameOptionsFor, getDeviceFrame } from '@/assets/device-frames'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Select } from '@/components/ui/select'
import { SwatchButton } from '@/components/ui/swatch-button'
import { FONT_WEIGHT_OPTIONS } from '@/lib/fonts'
import { getAppStoreProfile, type AppStoreProfile } from '@/lib/dimensions'
import type { GlobalSettings, DeviceModel } from '@/types'

export function GlobalsEditor() {
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const project = useProjectStore((s) => s.project)

  if (!showGlobalsEditor || !project) return null
  return (
    <GlobalsEditorContent
      globals={project.globals}
      profile={getAppStoreProfile(project.profileId)!}
    />
  )
}

function GlobalsEditorContent({
  globals,
  profile,
}: {
  globals: GlobalSettings
  profile: AppStoreProfile
}) {
  const setShowGlobalsEditor = useUIStore((s) => s.setShowGlobalsEditor)
  const [draft, setDraft] = useState<GlobalSettings>(() => ({ ...globals }))

  const frame = getDeviceFrame(draft.deviceModel)
  const modelOptions = deviceFrameOptionsFor(draft.deviceModel, profile.platform)

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
    <Dialog
      open
      onClose={handleClose}
      title="Réglages globaux"
      size="md"
      footer={
        <>
          <Button variant="default" onClick={handleClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="section-title mb-2">Profil du projet</h3>
          <div className="surface-inner p-3">
            <p className="text-sm font-medium text-foreground">{profile.name}</p>
            <p className="mt-1 text-2xs text-muted-foreground tabular-nums">
              {profile.portrait.width}×{profile.portrait.height} px · {profile.appStoreConnectType}
            </p>
            <p className="mt-1 text-2xs text-muted-foreground">
              Immuable pour préserver les coordonnées et les releases de ce projet.
            </p>
          </div>
        </section>

        <div className="hairline" />

        {/* Typographie */}
        <section>
          <h3 className="section-title mb-2">Typographie</h3>
          <div className="flex flex-col gap-2">
            <FontPicker
              label="Police"
              value={draft.fontFamily}
              onChange={(fontFamily) => update({ fontFamily })}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  label="Graisse"
                  value={draft.fontWeight}
                  onChange={(event) => update({ fontWeight: parseInt(event.target.value, 10) })}
                  aria-label="Graisse de police par défaut"
                >
                  {FONT_WEIGHT_OPTIONS.map((weight) => (
                    <option key={weight.value} value={weight.value}>
                      {weight.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-28">
                <NumberField
                  label="Taille"
                  ariaLabel="Taille de police par défaut"
                  value={draft.fontSize}
                  min={8}
                  max={200}
                  onChange={(fontSize) => update({ fontSize })}
                />
              </div>
            </div>
            <Field label="Couleur">
              <ColorPicker
                value={draft.fontColor}
                onChange={(fontColor) => update({ fontColor })}
              />
            </Field>
          </div>
        </section>

        <div className="hairline" />

        {/* Arrière-plan */}
        <section>
          <h3 className="section-title mb-2">Arrière-plan</h3>
          <BackgroundEditor
            background={draft.background}
            onChange={(background) => update({ background })}
          />
        </section>

        <div className="hairline" />

        {/* Appareil */}
        <section>
          <h3 className="section-title mb-2">Appareil</h3>
          <div className="flex flex-col gap-2">
            <Select
              label="Modèle"
              value={draft.deviceModel}
              onChange={(event) => handleModelChange(event.target.value as DeviceModel)}
              aria-label="Modèle d’appareil par défaut"
            >
              {modelOptions.map((option) => (
                <option key={option.model} value={option.model}>
                  {option.modelName} · {option.screenSize}
                </option>
              ))}
            </Select>
            <Field label="Couleur">
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
    </Dialog>
  )
}
