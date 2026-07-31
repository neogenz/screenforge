import { useState } from 'react'
import { TEMPLATES } from '@/assets/templates'
import { TemplatePreview } from './TemplatePreview'
import { useCanvasStore } from '@/stores/canvas.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TemplateDefinition } from '@/types'

type ApplyMode = 'current' | 'new'

export function TemplatePicker() {
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)

  if (!showTemplatesPicker) return null
  return <TemplatePickerContent />
}

function TemplatePickerContent() {
  const setShowTemplatesPicker = useUIStore((s) => s.setShowTemplatesPicker)
  const [selected, setSelected] = useState<TemplateDefinition | null>(null)

  function handleClose() {
    setShowTemplatesPicker(false)
  }

  function handleApply(mode: ApplyMode) {
    if (!selected) return
    const screenId = useCanvasStore.getState().applyTemplate(selected, mode)
    if (!screenId) {
      toast('Nombre maximum d’écrans atteint.', 'error')
      return
    }
    handleClose()
  }

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Modèles de mise en page"
      size="lg"
      footer={selected
        ? (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[12px] text-foreground-muted">{selected.name}</p>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" onClick={() => handleApply('current')}>
                Appliquer à l’écran actuel
              </Button>
              <Button variant="primary" onClick={() => handleApply('new')}>
                Nouvel écran
              </Button>
            </div>
          </div>
        )
        : undefined}
    >
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map((template) => {
          const isSelected = selected?.id === template.id
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelected(template)}
              aria-pressed={isSelected}
              aria-label={`Sélectionner le modèle ${template.name}`}
              className={cn(
                'group flex flex-col self-start overflow-hidden rounded-xl border bg-panel text-left',
                'transition-[border-color,box-shadow] duration-150 ease-out',
                'focus-visible:outline-none focus-visible:border-foreground-muted',
                isSelected
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border hover:border-border-strong',
              )}
            >
              <div className="h-60 w-full shrink-0 overflow-hidden border-b border-border bg-panel-muted">
                <TemplatePreview template={template} />
              </div>
              <div className="flex flex-col gap-1 px-3 py-2.5">
                <p className="text-[12px] font-medium text-foreground">{template.name}</p>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-muted">
                  {template.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
