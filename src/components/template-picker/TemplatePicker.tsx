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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] animate-[fade-in_0.14s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label="Template picker"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowTemplatesPicker(false)
      }}
    >
      <div
        className={cn(
          'relative flex w-[560px] max-w-[calc(100vw-40px)] max-h-[80vh] flex-col overflow-hidden',
          'surface-modal',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="mono-label">Library</span>
            <h2 className="text-[15px] font-medium text-foreground">Templates</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowTemplatesPicker(false)}
            aria-label="Close template picker"
            className="icon-btn"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Grid */}
        <div className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto p-3">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleCardClick(template)}
              className={cn(
                'group flex flex-col overflow-hidden rounded-md border border-border bg-panel text-left',
                'transition-[border-color,transform] duration-100 ease-out',
                'hover:border-foreground active:scale-[0.99]',
                'focus-visible:outline-none focus-visible:border-foreground',
              )}
              aria-label={`Apply ${template.name} template`}
            >
              <div
                className="w-full aspect-[9/16] border-b border-border"
                style={buildPreviewGradient(template)}
              />
              <div className="flex flex-col gap-0.5 px-3 py-2.5">
                <p className="text-[13px] font-medium text-foreground">{template.name}</p>
                <p className="mono-label line-clamp-2 leading-relaxed" style={{ textTransform: 'none', letterSpacing: '0' }}>
                  {template.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Confirm sub-dialog */}
      {confirm && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 animate-[fade-in_0.12s_ease-out]"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm template application"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirm(null)
          }}
        >
          <div
            className={cn(
              'flex w-[380px] flex-col gap-4 p-5',
              'surface-modal',
            )}
          >
            <div>
              <span className="mono-label">Apply</span>
              <p className="mt-1 text-[14px] font-medium text-foreground">
                {confirm.template.name}
              </p>
              <p className="mt-2 text-[12px] text-foreground-muted">
                Où souhaitez-vous appliquer ce template ?
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => handleApply('current')}
                className="btn-primary w-full"
              >
                Apply to current screen
              </button>
              <button
                type="button"
                onClick={() => handleApply('new')}
                className="btn-secondary w-full"
              >
                Create new screen
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="mono-label h-8 transition-colors hover:text-foreground"
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
