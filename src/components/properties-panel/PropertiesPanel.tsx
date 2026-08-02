import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '@/stores/canvas.store'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { TransformSection } from './TransformSection'
import { TextSection } from './TextSection'
import { DeviceSection } from './DeviceSection'
import { ImageSection } from './ImageSection'
import { ShapeSection } from './ShapeSection'
import { BackgroundSection } from './BackgroundSection'
import type { Layer } from '@/types'

type LayerScope = 'screen' | 'layout'

const SCOPE_OPTIONS: SegmentedOption<LayerScope>[] = [
  { value: 'screen', label: 'Cet écran' },
  { value: 'layout', label: 'Partager partout' },
]

export function PropertiesPanel() {
  const { layers, selectedLayerIds, setLayerScope } = useCanvasStore(
    useShallow((s) => ({
      layers: s.layers,
      selectedLayerIds: s.selectedLayerIds,
      setLayerScope: s.setLayerScope,
    })),
  )

  const selectedLayers = selectedLayerIds
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is Layer => l !== undefined)

  const selectedLayer = selectedLayers.length === 1 ? selectedLayers[0] : null

  let headerLabel = 'Arrière-plan'
  if (selectedLayers.length === 1) headerLabel = 'Propriétés'
  else if (selectedLayers.length > 1) headerLabel = 'Sélection'

  return (
    // Voir `LayersPanel` : l'îlot mesure son contenu, le drawer pose le plafond.
    <aside className="island flex max-h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between px-3.5">
        <span className="panel-title">{headerLabel}</span>
        {selectedLayers.length > 1 && (
          <span className="tabular text-[11px] text-faint">
            {String(selectedLayers.length).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Voir `LayersPanel` : `flex-1` effondrerait le contenu ici aussi. */}
      <div className="min-h-0 overflow-y-auto">
        {selectedLayers.length === 0 && (
          <div className="px-3.5 pb-3.5">
            <BackgroundSection />
          </div>
        )}

        {selectedLayers.length > 1 && (
          <div className="px-3.5 pb-3.5">
            <div className="surface-inner px-4 py-7 text-center">
              <p className="text-[12.5px] leading-relaxed text-foreground-muted">
                {selectedLayers.length} calques sélectionnés.
              </p>
              <p className="mt-1 text-[11px] text-faint">
                Sélectionnez un seul calque pour éditer.
              </p>
            </div>
          </div>
        )}

        {selectedLayer && (
          <>
            {/* Scope — screen-local or shared across all screens */}
            <div className="px-3.5 pb-3">
              <Segmented
                ariaLabel="Portée du calque"
                className="w-full"
                options={SCOPE_OPTIONS}
                value={selectedLayer.scope === 'layout' ? 'layout' : 'screen'}
                onChange={(scope) => setLayerScope(selectedLayer.id, scope)}
              />
            </div>

            <Section title="Transformation" defaultOpen>
              <TransformSection layer={selectedLayer} />
            </Section>

            {selectedLayer.type === 'text' && (
              <Section title="Texte" defaultOpen>
                <TextSection layer={selectedLayer} />
              </Section>
            )}

            {selectedLayer.type === 'device-frame' && (
              <Section title="Appareil" defaultOpen>
                <DeviceSection layer={selectedLayer} />
              </Section>
            )}

            {selectedLayer.type === 'image' && (
              <Section title="Image" defaultOpen>
                <ImageSection layer={selectedLayer} />
              </Section>
            )}

            {selectedLayer.type === 'shape' && (
              <Section title="Forme" defaultOpen>
                <ShapeSection layer={selectedLayer} />
              </Section>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children?: ReactNode
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    // Une section est une carte posée dans le panneau, pas une bande séparée
    // par un filet : c'est la matière qui groupe, le trait ne faisait que hacher.
    <div className="mx-3.5 mb-3 overflow-hidden rounded-md border border-border bg-inset/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center gap-1.5 px-2.5',
          'section-title',
          'transition-colors duration-150 ease-out hover:text-foreground',
        )}
        aria-expanded={open}
      >
        <ChevronRight
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            'shrink-0 text-faint transition-transform duration-150 ease-out',
            open && 'rotate-90',
          )}
        />
        <span>{title}</span>
      </button>

      {open && children && (
        <div className="px-2.5 pb-3 pt-0.5">{children}</div>
      )}
    </div>
  )
}
