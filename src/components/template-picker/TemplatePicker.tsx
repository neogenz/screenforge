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
            {/* Le libellé de la vignette tient sur un mot : c'est ici, une fois le
                modèle choisi, que sa description a la place d'être lue. */}
            <div className="flex min-w-0 flex-col">
              <p className="truncate text-sm font-medium text-foreground">{selected.name}</p>
              <p className="truncate text-2xs text-muted-foreground">{selected.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="default" onClick={() => handleApply('current')}>
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
      {/* Les vignettes portent le format de la planche (440×956) : à l'ancienne
          boîte carrée, l'aperçu flottait au centre de deux bandes vides plus
          larges que lui. Une colonne par modèle, la galerie tient d'un regard. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2">
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
                'group flex flex-col gap-2 self-start rounded-lg border p-2 text-left',
                'transition-[border-color,background] duration-150 ease-out',
                'focus-visible:outline-none focus-visible:border-muted-foreground',
                isSelected
                  ? 'border-muted-foreground bg-secondary'
                  : 'border-border hover:border-input hover:bg-accent',
              )}
            >
              <div className="aspect-[440/956] w-full overflow-hidden rounded-sm bg-stage shadow-(--hairline-top)">
                <TemplatePreview template={template} />
              </div>
              <p className="truncate px-0.5 text-2xs font-medium text-foreground">
                {template.name}
              </p>
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
