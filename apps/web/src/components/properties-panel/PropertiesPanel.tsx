import { MousePointer } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '@/stores/canvas.store'
import { useUIStore } from '@/stores/ui.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { Segmented } from '@/components/patterns/segmented'
import type { SegmentedOption } from '@/components/patterns/segmented'
import { PanelSection } from '@/components/patterns/panel-section'
import { DrawerBody, DrawerIsland } from '@/components/patterns/drawer-island'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { copy } from '@/lib/copy'
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

  const toggleProps = useUIStore((s) => s.toggleProps)

  const headerLabel = selectedLayers.length > 1 ? 'Sélection' : 'Propriétés'

  return (
    // Voir `LayersPanel` : l'îlot mesure son contenu, le drawer pose le plafond.
    // Le repère est nommé par son titre : l'intitulé change avec la sélection,
    // et `aria-labelledby` suit sans qu'on ait à le recopier.
    <DrawerIsland
      titleId="sf-properties-panel-title"
      title={headerLabel}
      headerExtra={
        selectedLayers.length > 1 ? (
          <span className="tabular-nums text-xs text-muted-foreground">
            {String(selectedLayers.length)}
          </span>
        ) : undefined
      }
      onClose={toggleProps}
      closeLabel="Fermer le panneau Propriétés"
    >
      {/* Voir `LayersPanel` : `flex-1` effondrerait le contenu ici aussi. */}
      <DrawerBody>
        <div className="flex flex-col gap-2">
          {selectedLayers.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MousePointer size={18} strokeWidth={1.5} aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{copy.empty.selectionTitle}</EmptyTitle>
                <EmptyDescription>{copy.empty.selectionDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {selectedLayers.length === 0 && (
            <PanelSection title="Arrière-plan" defaultOpen>
              <BackgroundSection />
            </PanelSection>
          )}

          {selectedLayers.length > 1 && (
            <div className="px-2 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {selectedLayers.length} calques sélectionnés.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sélectionnez un seul calque pour éditer.
              </p>
            </div>
          )}

          {selectedLayer && (
            <>
              {/* Scope — screen-local or shared across all screens */}
              <Segmented
                label="Portée"
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
                <PanelSection title="Texte" defaultOpen>
                  <TextSection layer={selectedLayer} />
                </PanelSection>
              )}

              {selectedLayer.type === 'device-frame' && (
                <PanelSection title="Appareil" defaultOpen>
                  <DeviceSection layer={selectedLayer} />
                </PanelSection>
              )}

              {selectedLayer.type === 'image' && (
                <PanelSection title="Image" defaultOpen>
                  <ImageSection layer={selectedLayer} />
                </PanelSection>
              )}

              {selectedLayer.type === 'shape' && (
                <PanelSection title="Forme" defaultOpen>
                  <ShapeSection layer={selectedLayer} />
                </PanelSection>
              )}

              {selectedLayer.type === 'icon' && (
                <PanelSection title="Icône" defaultOpen>
                  <IconSection layer={selectedLayer} />
                </PanelSection>
              )}

              <PanelSection title="Transformation" defaultOpen>
                <TransformSection layer={selectedLayer} />
              </PanelSection>
            </>
          )}
        </div>
      </DrawerBody>
    </DrawerIsland>
  )
}
