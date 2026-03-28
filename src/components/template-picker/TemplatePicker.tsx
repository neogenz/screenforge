import { useState } from 'react'
import { X } from 'lucide-react'
import { TEMPLATES } from '@/assets/templates'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import type { TemplateDefinition, Layer } from '@/types'

type ApplyMode = 'current' | 'new'

interface ConfirmState {
  template: TemplateDefinition
}

function buildPreviewGradient(template: TemplateDefinition): React.CSSProperties {
  const bg = template.background
  if (bg.type === 'solid') return { background: bg.color }
  if (bg.type === 'radial-gradient') {
    const stops = bg.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')
    return { background: `radial-gradient(circle, ${stops})` }
  }
  const stops = bg.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')
  return { background: `linear-gradient(${bg.angle}deg, ${stops})` }
}

function applyTemplate(template: TemplateDefinition, mode: ApplyMode) {
  const { setLayers, clearSelection } = useCanvasStore.getState()
  const { project, addScreen, updateScreenBackground, saveScreenLayers } = useProjectStore.getState()
  if (!project) return

  const newLayers: Layer[] = template.layers.map((l) => ({
    ...l,
    id: crypto.randomUUID(),
  }))

  if (mode === 'current') {
    const activeId = useCanvasStore.getState().activeScreenId || project.screens[0]?.id
    if (!activeId) return
    clearSelection()
    setLayers(newLayers)
    updateScreenBackground(activeId, template.background)
    saveScreenLayers(activeId, newLayers)
  } else {
    addScreen()
    // The new screen is appended — grab its id after creation
    const updatedProject = useProjectStore.getState().project
    if (!updatedProject) return
    const newScreen = updatedProject.screens[updatedProject.screens.length - 1]
    clearSelection()
    setLayers(newLayers)
    updateScreenBackground(newScreen.id, template.background)
    saveScreenLayers(newScreen.id, newLayers)
  }
}

export function TemplatePicker() {
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const setShowTemplatesPicker = useUIStore((s) => s.setShowTemplatesPicker)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  if (!showTemplatesPicker) return null

  function handleCardClick(template: TemplateDefinition) {
    setConfirm({ template })
  }

  function handleApply(mode: ApplyMode) {
    if (!confirm) return
    applyTemplate(confirm.template, mode)
    setConfirm(null)
    setShowTemplatesPicker(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Template picker"
    >
      <div className="relative bg-background rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Choose a Template</h2>
          <button
            type="button"
            onClick={() => setShowTemplatesPicker(false)}
            className="p-1 rounded hover:bg-surface-hover transition-colors text-muted"
            aria-label="Close template picker"
          >
            <X size={16} />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-5 grid grid-cols-2 gap-4">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleCardClick(template)}
              className={cn(
                'flex flex-col rounded-lg border border-border overflow-hidden text-left',
                'hover:border-primary hover:shadow-md transition-all cursor-pointer',
              )}
              aria-label={`Apply ${template.name} template`}
            >
              {/* Preview */}
              <div
                className="w-full aspect-[9/16]"
                style={buildPreviewGradient(template)}
              />
              {/* Info */}
              <div className="p-3 bg-surface">
                <p className="text-sm font-semibold text-foreground">{template.name}</p>
                <p className="text-xs text-muted mt-0.5 leading-tight">{template.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/30"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm template application"
        >
          <div className="bg-background rounded-xl shadow-2xl w-80 p-6 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Apply "{confirm.template.name}"</p>
              <p className="text-xs text-muted mt-1">Where would you like to apply this template?</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleApply('current')}
                className={cn(
                  'h-9 px-4 rounded bg-primary text-white text-sm font-medium',
                  'hover:bg-primary-hover transition-colors',
                )}
              >
                Apply to current screen
              </button>
              <button
                type="button"
                onClick={() => handleApply('new')}
                className={cn(
                  'h-9 px-4 rounded border border-border text-sm text-foreground',
                  'hover:bg-surface-hover transition-colors',
                )}
              >
                Create new screen
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="h-9 px-4 rounded text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
