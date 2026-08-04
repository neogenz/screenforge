import { useCallback, useMemo, useRef, useState } from 'react'
import { Search, Smartphone } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { LayerItem } from './LayerItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCanvasStore } from '@/stores/canvas.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { createDeviceLayer, layerDisplayName } from '@/lib/layer-factories'
import type { Layer } from '@/types'

/**
 * Floating-island layers panel: header + filter, grouped layer list
 * (shared layout layers first, then this screen's), empty states.
 * Row callbacks are defined once and take the layer as an argument so
 * memoized LayerItems skip re-renders on unrelated state changes.
 */
export function LayersPanel() {
  const layers = useProjectStore(useShallow((state) => getProjectLayers(state.project)))
  const selectedLayerIds = useCanvasStore((state) => state.selectedLayerIds)
  const defaultDeviceModel = useProjectStore((state) => state.project?.globals.deviceModel)

  const [query, setQuery] = useState('')
  const dragSourceId = useRef<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const layerGroups = useMemo(() => {
    // Le filtre porte sur le nom affiché : chercher « accrocheur » doit
    // trouver le calque que la liste montre sous ce mot, pas rien du tout.
    const matches = (layer: Layer) =>
      normalizedQuery.length === 0
      || layerDisplayName(layer).toLowerCase().includes(normalizedQuery)
    const byZIndexDesc = (first: Layer, second: Layer) => second.zIndex - first.zIndex
    return [
      {
        label: 'Partagé · tous les écrans',
        layers: layers
          .filter((layer) => layer.scope === 'layout' && matches(layer))
          .sort(byZIndexDesc),
      },
      {
        label: 'Cet écran',
        layers: layers
          .filter((layer) => layer.scope !== 'layout' && matches(layer))
          .sort(byZIndexDesc),
      },
    ].filter((group) => group.layers.length > 0)
  }, [layers, normalizedQuery])

  const selectedIds = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds])

  const handleSelect = useCallback((layer: Layer, event: React.MouseEvent) => {
    const { selectedLayerIds, selectLayer, selectLayers } = useCanvasStore.getState()
    if (event.metaKey || event.ctrlKey) {
      selectLayers(
        selectedLayerIds.includes(layer.id)
          ? selectedLayerIds.filter((id) => id !== layer.id)
          : [...selectedLayerIds, layer.id],
      )
    } else {
      selectLayer(layer.id)
    }
  }, [])

  const handleSelectExclusive = useCallback((layer: Layer) => {
    useCanvasStore.getState().selectLayer(layer.id)
  }, [])

  const handleDragStart = useCallback((layer: Layer, event: React.DragEvent) => {
    dragSourceId.current = layer.id
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((layer: Layer, event: React.DragEvent) => {
    event.preventDefault()
    const sourceId = dragSourceId.current
    const { reorderLayer } = useCanvasStore.getState()
    const layers = getProjectLayers(useProjectStore.getState().project)
    const source = layers.find((candidate) => candidate.id === sourceId)
    if (source && source.id !== layer.id && source.scope === layer.scope) {
      reorderLayer(source.id, layer.zIndex)
    }
    dragSourceId.current = null
  }, [])

  const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }, [])

  const handleAddDevice = useCallback(() => {
    if (!defaultDeviceModel) return
    const { addLayer } = useCanvasStore.getState()
    const layers = getProjectLayers(useProjectStore.getState().project)
    addLayer(createDeviceLayer(defaultDeviceModel, layers.length))
  }, [defaultDeviceModel])

  return (
    // `max-h-full` sans `h-full` : l'îlot s'arrête sous sa dernière ligne et ne
    // défile qu'une fois le plafond du drawer atteint.
    <div className="island island-flush flex max-h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <span className="panel-title">Calques</span>
          <span className="tabular text-2xs text-muted-foreground">
            {String(layers.length).padStart(2, '0')}
          </span>
        </div>
        <div className="relative mt-2">
          <Search
            size={13}
            strokeWidth={1.5}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            font="sans"
            value={query}
            onChange={handleQueryChange}
            placeholder="Filtrer…"
            aria-label="Filtrer les calques"
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea
        // Pas de `flex-1` : sa base de 0 effondre la liste dans un conteneur à
        // hauteur automatique. `flex: 0 1 auto` la dimensionne sur son contenu
        // puis la laisse rétrécir — et défiler — une fois le plafond atteint.
        className="px-2 pb-2"
        role="listbox"
        aria-label="Calques"
        aria-multiselectable
      >
        {layers.length === 0 && (
          <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
            <Smartphone size={20} strokeWidth={1.5} className="text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Écran vide.</p>
            <p className="max-w-[190px] text-2xs leading-relaxed text-muted-foreground">
              Ajoutez un cadre iPhone, un texte ou une image depuis la barre d'outils.
            </p>
            <Button variant="default" size="sm" className="mt-2" onClick={handleAddDevice}>
              Ajouter un cadre iPhone
            </Button>
          </div>
        )}

        {layers.length > 0 && layerGroups.length === 0 && (
          <p className="py-6 text-center text-2xs text-muted-foreground">
            Aucun calque pour « {query.trim()} »
          </p>
        )}

        {layerGroups.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <p className="field-label px-2 pb-2 pt-4">{group.label}</p>
            {group.layers.map((layer) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                isSelected={selectedIds.has(layer.id)}
                onSelect={handleSelect}
                onSelectExclusive={handleSelectExclusive}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>
        ))}
      </ScrollArea>
    </div>
  )
}
