import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { TEMPLATES } from '@/assets/templates'
import { TemplatePreview } from './TemplatePreview'
import { useCanvasStore } from '@/stores/canvas.store'
import { useTemplatesStore } from '@/stores/templates.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/patterns/icon-button'
import { instantiateTemplate, type CustomTemplate } from '@/lib/custom-templates'
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
  const custom = useTemplatesStore((s) => s.templates)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /* Le choix est gardé par identifiant et relu à chaque rendu : supprimer le
     gabarit sélectionné doit vider le pied de page, pas y laisser un bouton
     « Appliquer » qui pointe sur ce qui n'existe plus. */
  const saved = custom.find((template) => template.id === selectedId) ?? null
  const selected: TemplateDefinition | null =
    saved ?? TEMPLATES.find((template) => template.id === selectedId) ?? null

  function handleClose() {
    setShowTemplatesPicker(false)
  }

  function handleApply(mode: ApplyMode) {
    if (!selected) return
    /* Un gabarit enregistré porte ses images : les ré-enregistrer ici est ce
       qui les fait exister dans le projet où il atterrit. */
    const definition = saved ? instantiateTemplate(saved) : selected
    const screenId = useCanvasStore.getState().applyTemplate(definition, mode)
    if (!screenId) {
      toast('Nombre maximum d’écrans atteint.', 'error')
      return
    }
    handleClose()
  }

  async function handleRemove(template: CustomTemplate) {
    await useTemplatesStore.getState().remove(template.id)
    toast(`Gabarit « ${template.name} » supprimé.`, 'success')
  }

  return (
    <DialogShell
      open
      onClose={handleClose}
      title="Modèles de mise en page"
      size="lg"
      footer={
        selected ? (
          <div className="flex w-full items-center justify-between gap-3">
            {/* Le libellé de la vignette tient sur un mot : c'est ici, une fois le
                modèle choisi, que sa description a la place d'être lue. */}
            <div className="flex min-w-0 flex-col">
              <p className="truncate text-sm font-medium text-foreground">{selected.name}</p>
              <p className="truncate text-2xs text-muted-foreground">{selected.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" onClick={() => handleApply('current')}>
                Appliquer à l’écran actuel
              </Button>
              <Button variant="default" onClick={() => handleApply('new')}>
                Nouvel écran
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {/* 8 entre les sections, 6 entre un titre et ce qu'il nomme : les deux
          écarts de l'échelle, dans leur emploi respectif. */}
      <div className="flex flex-col gap-2">
        {/* Les siens d'abord : le catalogue livré ne change jamais, sa
            bibliothèque oui, et c'est elle qu'on vient rouvrir. */}
        {custom.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="section-title">Mes gabarits</h3>
            <Gallery
              templates={custom}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={handleRemove}
            />
          </section>
        )}
        <section className="flex flex-col gap-1.5">
          {custom.length > 0 && <h3 className="section-title">Catalogue</h3>}
          <Gallery templates={TEMPLATES} selectedId={selectedId} onSelect={setSelectedId} />
        </section>
      </div>
    </DialogShell>
  )
}

interface GalleryProps {
  templates: readonly TemplateDefinition[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove?: (template: CustomTemplate) => void
}

/** `source` n'existe que sur un gabarit enregistré : c'est ce qui les sépare. */
function savedOf(template: TemplateDefinition): CustomTemplate | null {
  return 'source' in template ? (template as CustomTemplate) : null
}

function Gallery({ templates, selectedId, onSelect, onRemove }: GalleryProps) {
  return (
    /* Les vignettes portent le format de la planche (440×956) : à l'ancienne
       boîte carrée, l'aperçu flottait au centre de deux bandes vides plus
       larges que lui. Une colonne par modèle, la galerie tient d'un regard. */
    <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2">
      {templates.map((template) => {
        const saved = savedOf(template)
        const isSelected = selectedId === template.id
        return (
          <div key={template.id} className="group/tile relative self-start">
            <Button
              variant="ghost"
              onClick={() => onSelect(template.id)}
              aria-pressed={isSelected}
              aria-label={`Sélectionner le modèle ${template.name}`}
              className={cn(
                'h-auto w-full flex-col items-stretch gap-2 rounded-lg border p-2 text-left font-normal',
                isSelected
                  ? 'border-foreground bg-muted'
                  : 'border-border hover:border-input hover:bg-accent',
              )}
            >
              <div className="aspect-[440/956] w-full overflow-hidden rounded-sm bg-stage shadow-(--hairline-top)">
                <TemplatePreview template={template} assets={saved?.assets} />
              </div>
              <div className="flex min-w-0 items-center gap-1 px-0.5">
                <p className="truncate text-2xs font-medium text-foreground">{template.name}</p>
                {/* Neutre, et seulement quand c'est vrai : « IA » dit d'où vient
                    la mise en page, il ne la recommande pas. */}
                {saved?.source === 'ai' && (
                  <span className="shrink-0 rounded-sm bg-secondary px-1 text-2xs text-muted-foreground">
                    IA
                  </span>
                )}
              </div>
            </Button>
            {saved && onRemove && (
              <IconButton
                size="sm"
                aria-label={`Supprimer le gabarit ${template.name}`}
                /* Visible au survol et dès qu'il a le focus : au seul survol,
                   la suppression n'existerait pas au clavier. */
                className="absolute right-1 top-1 opacity-0 focus-visible:opacity-100 group-hover/tile:opacity-100"
                onClick={() => void onRemove(saved)}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </IconButton>
            )}
          </div>
        )
      })}
    </div>
  )
}
