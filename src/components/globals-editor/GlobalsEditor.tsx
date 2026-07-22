import { useState } from 'react'
import { X } from 'lucide-react'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { FontPicker } from '@/components/text-editor/FontPicker'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import { DEVICE_FRAMES } from '@/assets/device-frames'
import { cn } from '@/lib/utils'
import { inputCls } from '@/components/properties-panel/TransformSection'
import type { GlobalSettings, DeviceModel, DeviceColor } from '@/types'

const FONT_WEIGHTS: { value: number; label: string }[] = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extrabold' },
  { value: 900, label: 'Black' },
]

export function GlobalsEditor() {
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const setShowGlobalsEditor = useUIStore((s) => s.setShowGlobalsEditor)
  const globals = useProjectStore((s) => s.project?.globals)
  const updateGlobals = useProjectStore((s) => s.updateGlobals)

  const [draftOverride, setDraftOverride] = useState<GlobalSettings | null>(null)
  const draft = draftOverride ?? globals ?? null

  if (!showGlobalsEditor || !draft) return null

  function update(partial: Partial<GlobalSettings>) {
    setDraftOverride((previous) => ({ ...(previous ?? draft), ...partial } as GlobalSettings))
  }

  function handleClose() {
    setDraftOverride(null)
    setShowGlobalsEditor(false)
  }

  function handleSave() {
    if (!draft) return
    updateGlobals(draft)
    handleClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] animate-[fade-in_0.14s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label="Global settings editor"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className={cn(
          'relative flex w-[440px] max-w-[calc(100vw-40px)] max-h-[80vh] flex-col overflow-hidden',
          'surface-modal',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="mono-label">Defaults</span>
            <h2 className="text-[15px] font-medium text-foreground">Globals</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close globals editor"
            className="icon-btn"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Scroll content */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          {/* Typography */}
          <section>
            <h3 className="mono-label-strong mb-3 block">Typography</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mono-label mb-1.5 block">Family</label>
                <FontPicker
                  value={draft.fontFamily}
                  onChange={(fontFamily) => update({ fontFamily })}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mono-label mb-1.5 block">Weight</label>
                  <select
                    value={draft.fontWeight}
                    onChange={(e) => update({ fontWeight: parseInt(e.target.value, 10) })}
                    className={inputCls}
                  >
                    {FONT_WEIGHTS.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="mono-label mb-1.5 block">Size</label>
                  <input
                    type="number"
                    min={8}
                    max={200}
                    value={draft.fontSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v) && v >= 8) update({ fontSize: v })
                    }}
                    className={inputCls}
                    aria-label="Font size"
                  />
                </div>
              </div>
              <div>
                <label className="mono-label mb-1.5 block">Color</label>
                <ColorPicker
                  value={draft.fontColor}
                  onChange={(fontColor) => update({ fontColor })}
                />
              </div>
            </div>
          </section>

          <div className="hairline" />

          {/* Background */}
          <section>
            <h3 className="mono-label-strong mb-3 block">Background</h3>
            <BackgroundEditor
              background={draft.background}
              onChange={(background) => update({ background })}
            />
          </section>

          <div className="hairline" />

          {/* Device */}
          <section>
            <h3 className="mono-label-strong mb-3 block">Device</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mono-label mb-1.5 block">Model</label>
                <select
                  value={draft.deviceModel}
                  onChange={(e) => {
                    const model = e.target.value as DeviceModel
                    const frame = DEVICE_FRAMES.find((f) => f.model === model)
                    const firstColor = frame?.colors[0]?.name ?? draft.deviceColor
                    update({ deviceModel: model, deviceColor: firstColor })
                  }}
                  className={inputCls}
                >
                  {DEVICE_FRAMES.map((f) => (
                    <option key={f.model} value={f.model}>{f.modelName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mono-label mb-2 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {(DEVICE_FRAMES.find((f) => f.model === draft.deviceModel)?.colors ?? []).map((c) => {
                    const selected = draft.deviceColor === c.name
                    return (
                      <button
                        key={c.name}
                        type="button"
                        title={c.label}
                        onClick={() => update({ deviceColor: c.name as DeviceColor })}
                        className={cn(
                          'h-6 w-6 rounded-full border transition-[border-color,transform] duration-100 ease-out',
                          selected
                            ? 'border-foreground scale-110'
                            : 'border-border hover:border-border-strong',
                        )}
                        style={{ backgroundColor: c.frame }}
                        aria-label={c.label}
                        aria-pressed={selected}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary"
          >
            Save defaults
          </button>
        </div>
      </div>
    </div>
  )
}
