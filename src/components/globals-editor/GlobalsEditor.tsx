import { useState } from 'react'
import { X } from 'lucide-react'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { FontPicker } from '@/components/text-editor/FontPicker'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { BackgroundEditor } from '@/components/background-editor/BackgroundEditor'
import { DEVICE_FRAMES } from '@/assets/device-frames'
import { cn } from '@/lib/utils'
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

  const [draft, setDraft] = useState<GlobalSettings | null>(globals ?? null)

  if (!showGlobalsEditor || !draft) return null

  function update(partial: Partial<GlobalSettings>) {
    setDraft((prev) => prev ? { ...prev, ...partial } : prev)
  }

  function handleSave() {
    if (!draft) return
    updateGlobals(draft)
    setShowGlobalsEditor(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Global settings editor"
    >
      <div className="relative bg-background rounded-xl shadow-2xl w-[400px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Global Defaults</h2>
          <button
            type="button"
            onClick={() => setShowGlobalsEditor(false)}
            className="p-1 rounded hover:bg-surface-hover transition-colors text-muted"
            aria-label="Close globals editor"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-6">
          {/* Typography section */}
          <section>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Typography
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Font Family</label>
                <FontPicker
                  value={draft.fontFamily}
                  onChange={(fontFamily) => update({ fontFamily })}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted block mb-1">Weight</label>
                  <select
                    value={draft.fontWeight}
                    onChange={(e) => update({ fontWeight: parseInt(e.target.value, 10) })}
                    className={cn(
                      'w-full h-8 px-2 text-xs rounded border border-border',
                      'bg-surface text-foreground focus:outline-none focus:border-primary',
                    )}
                  >
                    {FONT_WEIGHTS.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <label className="text-xs text-muted block mb-1">Size</label>
                  <input
                    type="number"
                    min={8}
                    max={200}
                    value={draft.fontSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v) && v >= 8) update({ fontSize: v })
                    }}
                    className={cn(
                      'w-full h-8 px-2 text-xs rounded border border-border',
                      'bg-surface text-foreground focus:outline-none focus:border-primary',
                    )}
                    aria-label="Font size"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Text Color</label>
                <ColorPicker
                  value={draft.fontColor}
                  onChange={(fontColor) => update({ fontColor })}
                />
              </div>
            </div>
          </section>

          {/* Background section */}
          <section>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Background
            </h3>
            <BackgroundEditor
              background={draft.background}
              onChange={(background) => update({ background })}
            />
          </section>

          {/* Device section */}
          <section>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Device
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Model</label>
                <select
                  value={draft.deviceModel}
                  onChange={(e) => {
                    const model = e.target.value as DeviceModel
                    const frame = DEVICE_FRAMES.find((f) => f.model === model)
                    const firstColor = frame?.colors[0]?.name ?? draft.deviceColor
                    update({ deviceModel: model, deviceColor: firstColor })
                  }}
                  className={cn(
                    'w-full h-8 px-2 text-xs rounded border border-border',
                    'bg-surface text-foreground focus:outline-none focus:border-primary',
                  )}
                >
                  {DEVICE_FRAMES.map((f) => (
                    <option key={f.model} value={f.model}>{f.modelName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {(DEVICE_FRAMES.find((f) => f.model === draft.deviceModel)?.colors ?? []).map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.label}
                      onClick={() => update({ deviceColor: c.name as DeviceColor })}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition-all',
                        draft.deviceColor === c.name
                          ? 'border-primary scale-110'
                          : 'border-border hover:scale-105',
                      )}
                      style={{ backgroundColor: c.frame }}
                      aria-label={c.label}
                      aria-pressed={draft.deviceColor === c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowGlobalsEditor(false)}
            className={cn(
              'h-8 px-4 text-xs rounded border border-border',
              'text-foreground hover:bg-surface-hover transition-colors',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              'h-8 px-4 text-xs rounded bg-primary text-white font-medium',
              'hover:bg-primary-hover transition-colors',
            )}
          >
            Save Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
