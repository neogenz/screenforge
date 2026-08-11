import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '@/stores/canvas.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { TransformSection } from './TransformSection'
import { TextSection } from './TextSection'
import { DeviceSection } from './DeviceSection'
import { ImageSection } from './ImageSection'
import { IconSection } from '@/components/properties-panel/IconSection'
import { ShapeSection } from './ShapeSection'
import { BackgroundSection } from './BackgroundSection'
import type { Layer } from '@/types'

type LayerScope = 'screen' | 'layout'

const SCOPE_OPTIONS: SegmentedOption<LayerScope>[] = [
  { value: 'screen', label: 'Cet écran' },
  { value: 'layout', label: 'Partager partout' },
]

export function PropertiesPanel() {
  const { selectedLayerIds, setLayerScope } = useCanvasStore(
    useShallow((s) => ({
      selectedLayerIds: s.selectedLayerIds,
      setLayerScope: s.setLayerScope,
    })),
  )
  const layers = useProjectStore(useShallow((state) => getProjectLayers(state.project)))

  const selectedLayers = selectedLayerIds
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is Layer => l !== undefined)

  const selectedLayer = selectedLayers.length === 1 ? selectedLayers[0] : null

  let headerLabel = 'Arrière-plan'
  if (selectedLayers.length === 1) headerLabel = 'Propriétés'
  else if (selectedLayers.length > 1) headerLabel = 'Sélection'

  return (
    // Voir `LayersPanel` : l'îlot mesure son contenu, le drawer pose le plafond.
    // Le repère est nommé par son titre : l'intitulé change avec la sélection,
    // et `aria-labelledby` suit sans qu'on ait à le recopier.
    <aside
      aria-labelledby="sf-properties-panel-title"
      className="island island-flush flex max-h-full min-h-0 flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <h2 id="sf-properties-panel-title" className="panel-title">
          {headerLabel}
        </h2>
        {selectedLayers.length > 1 && (
          <span className="tabular text-2xs text-muted-foreground">
            {String(selectedLayers.length).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Voir `LayersPanel` : `flex-1` effondrerait le contenu ici aussi. */}
      <ScrollArea className="px-3 pb-3" contentClassName="flex flex-col gap-2">
        {selectedLayers.length === 0 && <BackgroundSection />}

        {selectedLayers.length > 1 && (
          <div className="px-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {selectedLayers.length} calques sélectionnés.
            </p>
            <p className="mt-1 text-2xs text-muted-foreground">
              Sélectionnez un seul calque pour éditer.
            </p>
          </div>
        )}

        {selectedLayer && (
          <>
            {/* Scope — screen-local or shared across all screens */}
            <Segmented
              ariaLabel="Portée du calque"
              className="w-full"
              options={SCOPE_OPTIONS}
              value={selectedLayer.scope === 'layout' ? 'layout' : 'screen'}
              onChange={(scope) => setLayerScope(selectedLayer.id, scope)}
            />

            {/* Ce qu'on est venu régler d'abord, la géométrie ensuite.
                On sélectionne un texte pour changer son texte, une icône pour
                changer son icône — pas pour pousser son X d'un pixel. La
                transformation est la seule section commune aux six types :
                c'est ce qui en fait le socle, pas l'en-tête. */}
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

            {selectedLayer.type === 'icon' && (
              <Section title="Icône" defaultOpen>
                <IconSection layer={selectedLayer} />
              </Section>
            )}

            <Section title="Transformation" defaultOpen>
              <TransformSection layer={selectedLayer} />
            </Section>
          </>
        )}
      </ScrollArea>
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
    /*
     * Une bande, pas une carte.
     *
     * La carte creusée coûtait un troisième niveau de surface — l'îlot porte
     * la carte, la carte porte le champ — et en thème clair les trois se
     * lisaient comme des boîtes emboîtées. Elle coûtait aussi 18px de largeur
     * à chaque champ, en bordure et en retrait redoublés.
     *
     * Ce que le filet seul ne fait pas, c'est grouper : c'est le rythme qui
     * s'en charge. L'écart du conteneur (8) plus le retrait haut (8) posent
     * 16px au-dessus du titre contre 4 en dessous, et un titre respire
     * toujours vers ce qu'il annonce.
     */
    <div className="border-t border-border pt-2 first:border-t-0 first:pt-0">
      {/* Un titre qui porte son bouton, motif d'accordéon de l'APG : le bouton
          seul se parcourait à la tabulation mais restait invisible au saut de
          titre, alors que c'est bien lui qui découpe le panneau. Le `h3` porte
          la typographie, le bouton la mise en boîte. */}
      <h3 className="section-title">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-8 w-full items-center gap-1.5',
            'transition-colors duration-150 ease-out hover:text-foreground',
          )}
          aria-expanded={open}
        >
          <ChevronRight
            size={12}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              'shrink-0 text-muted-foreground transition-transform duration-150 ease-out',
              open && 'rotate-90',
            )}
          />
          <span>{title}</span>
        </button>
      </h3>

      {open && children && <div className="pb-1">{children}</div>}
    </div>
  )
}
