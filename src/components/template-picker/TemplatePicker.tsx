import { useState } from 'react'
import { X } from 'lucide-react'
import { TEMPLATES } from '@/assets/templates'
import { TemplatePreview } from './TemplatePreview'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import type { TemplateDefinition } from '@/types'

type ApplyMode = 'current' | 'new'

interface ConfirmState {
  template: TemplateDefinition
}

export function TemplatePicker() {
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const setShowTemplatesPicker = useUIStore((s) => s.setShowTemplatesPicker)
  const project = useProjectStore((s) => s.project)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)

  if (!showTemplatesPicker) return null

  function handleCardClick(template: TemplateDefinition) {
    setApplyError(null)
    setConfirm({ template })
  }

  function handleApply(mode: ApplyMode) {
    if (!confirm) return
    const screenId = useCanvasStore.getState().applyTemplate(confirm.template, mode)
    if (!screenId) {
      setApplyError('Le projet contient déjà dix écrans.')
      return
    }
    setApplyError(null)
    setConfirm(null)
    setShowTemplatesPicker(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] animate-[fade-in_0.14s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label="Sélecteur de modèles"
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
            <span className="mono-label">Bibliothèque</span>
            <h2 className="text-[15px] font-medium text-foreground">Modèles</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowTemplatesPicker(false)}
            aria-label="Fermer les modèles"
            className="icon-btn"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Grid */}
        <div className="grid min-h-0 auto-rows-max grid-cols-2 items-start gap-2 overflow-y-auto p-3">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleCardClick(template)}
              className={cn(
                'group flex flex-col self-start overflow-hidden rounded-md border border-border bg-panel text-left',
                'transition-[border-color,transform] duration-100 ease-out',
                'hover:border-foreground active:scale-[0.99]',
                'focus-visible:outline-none focus-visible:border-foreground',
              )}
              aria-label={`Appliquer le modèle ${template.name}`}
            >
              <div className="h-60 w-full shrink-0 overflow-hidden border-b border-border bg-panel-muted">
                <TemplatePreview template={template} />
              </div>
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
          aria-label="Confirmer l’application du modèle"
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
              <span className="mono-label">Appliquer</span>
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
                Appliquer à l’écran courant
              </button>
              <button
                type="button"
                onClick={() => handleApply('new')}
                disabled={(project?.screens.length ?? 0) >= MAX_PROJECT_SCREENS}
                className="btn-secondary w-full"
              >
                Créer un nouvel écran
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="mono-label h-8 transition-colors hover:text-foreground"
              >
                Annuler
              </button>
            </div>
            {applyError && <p role="alert" className="text-[11px] text-danger">{applyError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
