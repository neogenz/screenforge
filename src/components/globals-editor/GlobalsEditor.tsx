import { useState } from 'react'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { FontPicker } from '@/components/text-editor/FontPicker'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import { CURRENT_DEVICE_FRAMES, getDeviceFrame } from '@/assets/device-frames'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { cn } from '@/lib/utils'
import type { GlobalSettings, DeviceModel } from '@/types'

const FONT_WEIGHTS: { value: number; label: string }[] = [
  { value: 300, label: 'Léger' },
  { value: 400, label: 'Normal' },
  { value: 500, label: 'Moyen' },
  { value: 600, label: 'Semi-gras' },
  { value: 700, label: 'Gras' },
  { value: 800, label: 'Extra-gras' },
  { value: 900, label: 'Noir' },
]

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
  const modelOptions = frame.current
    ? CURRENT_DEVICE_FRAMES
    : [frame, ...CURRENT_DEVICE_FRAMES]

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
          <Button variant="secondary" onClick={handleClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Typographie */}
        <section>
          <h3 className="mono-label-strong mb-3">Typographie</h3>
          <div className="flex flex-col gap-3">
            <Field label="Police">
              <FontPicker
                value={draft.fontFamily}
                onChange={(fontFamily) => update({ fontFamily })}
              />
            </Field>
            <div className="flex gap-3">
              <Field label="Graisse" className="flex-1">
                <select
                  value={draft.fontWeight}
                  onChange={(event) => update({ fontWeight: parseInt(event.target.value, 10) })}
                  className="input"
                  aria-label="Graisse de police par défaut"
                >
                  {FONT_WEIGHTS.map((weight) => (
                    <option key={weight.value} value={weight.value}>{weight.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Taille" className="w-28">
                <NumberField
                  label="px"
                  ariaLabel="Taille de police par défaut"
                  value={draft.fontSize}
                  min={8}
                  max={200}
                  onChange={(fontSize) => update({ fontSize })}
                />
              </Field>
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
          <h3 className="mono-label-strong mb-3">Arrière-plan</h3>
          <BackgroundEditor
            background={draft.background}
            onChange={(background) => update({ background })}
          />
        </section>

        <div className="hairline" />

        {/* Appareil */}
        <section>
          <h3 className="mono-label-strong mb-3">Appareil</h3>
          <div className="flex flex-col gap-3">
            <Field label="Modèle">
              <select
                value={draft.deviceModel}
                onChange={(event) => handleModelChange(event.target.value as DeviceModel)}
                className="input"
                aria-label="Modèle d’appareil par défaut"
              >
                {modelOptions.map((option) => (
                  <option key={option.model} value={option.model}>
                    {option.modelName} · {option.screenSize}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Couleur">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Couleur de l’appareil par défaut">
                {frame.colors.map((color) => {
                  const selected = draft.deviceColor === color.name
                  return (
                    <button
                      key={color.name}
                      type="button"
                      title={color.label}
                      onClick={() => update({ deviceColor: color.name })}
                      className={cn(
                        'h-7 w-7 rounded-full border transition-[border-color,transform] duration-100 ease-out',
                        selected
                          ? 'scale-110 border-foreground'
                          : 'border-border hover:border-border-strong',
                      )}
                      style={{ backgroundColor: color.frame }}
                      aria-label={color.label}
                      aria-pressed={selected}
                    />
                  )
                })}
              </div>
            </Field>
          </div>
        </section>
      </div>
    </Dialog>
  )
}
