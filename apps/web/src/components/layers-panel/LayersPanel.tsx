import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageUp, Search, Smartphone } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { LayerItem } from './LayerItem'
import { Button } from '@/components/ui/button'
import { Empty, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DrawerIsland } from '@/components/patterns/drawer-island'
import { useCanvasStore } from '@/stores/canvas.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { createDeviceLayer, layerDisplayName } from '@/lib/layer-factories'
import { SCREENSHOT_IMAGE_ACCEPT } from '@/lib/image'
import { useUIStore } from '@/stores/ui.store'
import type { Layer } from '@/types'

type LayerRow = { layer: Layer; ghost: boolean }

/**
 * Floating-island layers panel: header + filter, grouped layer list
 * (shared layout layers first, then this screen's), empty states.
 * Row callbacks are defined once and take the layer as an argument so
 * memoized LayerItems skip re-renders on unrelated state changes.
 */
export function LayersPanel() {
  const layers = useProjectStore(useShallow((state) => getProjectLayers(state.project)))
  const activeScreenId = useProjectStore((state) => state.project?.activeScreenId)
  const selectedLayerIds = useCanvasStore((state) => state.selectedLayerIds)
  const defaultDeviceModel = useProjectStore((state) => state.project?.globals.deviceModel)

  const [query, setQuery] = useState('')
  const dragSourceId = useRef<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  /* Sortie de ligne : le store retire le calque à l'instant de l'action, donc
     le nœud partirait sans transition. On garde une copie fantôme le temps de
     l'animation — décorative, inerte, jamais interactive — puis on la lâche.
     La comparaison porte sur `layers`, pas sur la liste filtrée : un calque
     masqué par la recherche n'a pas été supprimé. */
  const [previousLayers, setPreviousLayers] = useState<Layer[]>(layers)
  const [previousScreenId, setPreviousScreenId] = useState(activeScreenId)
  const [ghosts, setGhosts] = useState<Layer[]>([])
  if (activeScreenId !== previousScreenId) {
    /* Changer d'écran remplace toute la liste : rien n'a été supprimé, et une
       sortie de masse des calques de l'ancien écran ne dirait rien de vrai. */
    setPreviousScreenId(activeScreenId)
    setPreviousLayers(layers)
    if (ghosts.length > 0) setGhosts([])
  } else if (layers !== previousLayers) {
    const currentIds = new Set(layers.map((layer) => layer.id))
    /* Un calque revenu (undo) reprend sa ligne vive : sa copie fantôme part,
       sinon la liste le montrait deux fois le temps de l'animation. */
    const survivors = ghosts.filter((ghost) => !currentIds.has(ghost.id))
    const removed = previousLayers.filter(
      (layer) => !currentIds.has(layer.id) && !survivors.some((ghost) => ghost.id === layer.id),
    )
    setPreviousLayers(layers)
    if (removed.length > 0 && previousLayers.length > 0) setGhosts([...survivors, ...removed])
    else if (survivors.length !== ghosts.length) setGhosts(survivors)
  }
  useEffect(() => {
    if (ghosts.length === 0) return
    const timer = window.setTimeout(() => setGhosts([]), 240)
    return () => window.clearTimeout(timer)
  }, [ghosts])

  const layerGroups = useMemo(() => {
    // Le filtre porte sur le nom affiché : chercher « accrocheur » doit
    // trouver le calque que la liste montre sous ce mot, pas rien du tout.
    const matches = (layer: Layer) =>
      normalizedQuery.length === 0 ||
      layerDisplayName(layer).toLowerCase().includes(normalizedQuery)
    const byZIndexDesc = (first: LayerRow, second: LayerRow) =>
      second.layer.zIndex - first.layer.zIndex
    /* Les fantômes de sortie sont fusionnés dans leur groupe et triés au même
       zIndex : la ligne supprimée sort à la place qu'elle occupait, pas
       reléguée en bas de liste — et elle passe le même filtre que les
       vivantes, un calque que la recherche masquait ne sort nulle part. */
    const rowsFor = (isLayout: boolean): LayerRow[] =>
      [
        ...layers
          .filter((layer) => (layer.scope === 'layout') === isLayout && matches(layer))
          .map((layer) => ({ layer, ghost: false })),
        ...ghosts
          .filter((layer) => (layer.scope === 'layout') === isLayout && matches(layer))
          .map((layer) => ({ layer, ghost: true })),
      ].sort(byZIndexDesc)
    return [
      { label: 'Partagé · tous les écrans', rows: rowsFor(true) },
      { label: 'Cet écran', rows: rowsFor(false) },
    ].filter((group) => group.rows.length > 0)
  }, [layers, normalizedQuery, ghosts])

  const selectedIds = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds])

  /* Modèle listbox : un seul arrêt de Tab pour toute la liste, les flèches
     déplacent le focus de ligne en ligne. Sans ça chaque ligne était un arrêt
     et les flèches étaient avalées par la garde globale — le rôle annonçait un
     widget que le clavier ne pouvait pas piloter. */
  const optionIds = useMemo(
    () =>
      layerGroups.flatMap((group) =>
        group.rows.filter((row) => !row.ghost).map((row) => row.layer.id),
      ),
    [layerGroups],
  )
  const [focusId, setFocusId] = useState<string | null>(null)
  const anchorId = useRef<string | null>(null)
  const activeFocusId =
    focusId && optionIds.includes(focusId)
      ? focusId
      : (selectedLayerIds.find((id) => optionIds.includes(id)) ?? optionIds[0] ?? null)

  const handleNavigate = useCallback(
    (layer: Layer, key: string, extend: boolean) => {
      const ids = optionIds
      const index = ids.indexOf(layer.id)
      if (index === -1) return
      const nextIndex =
        key === 'ArrowDown'
          ? Math.min(ids.length - 1, index + 1)
          : key === 'ArrowUp'
            ? Math.max(0, index - 1)
            : key === 'Home'
              ? 0
              : ids.length - 1
      const nextId = ids[nextIndex]
      if (!nextId || nextId === layer.id) return
      setFocusId(nextId)
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(nextId)}"]`)?.focus()
      })
      if (extend) {
        // ⇧ étend depuis l'ancre : la dernière sélection exclusive, comme dans
        // le Finder. Sans ancre enregistrée, la ligne de départ en tient lieu.
        const anchor = anchorId.current ?? layer.id
        const anchorIndex = ids.indexOf(anchor)
        if (anchorIndex === -1) return
        const [from, to] =
          anchorIndex <= nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex]
        useCanvasStore.getState().selectLayers(ids.slice(from, to + 1))
      } else {
        anchorId.current = nextId
      }
    },
    [optionIds],
  )

  const handleFocusRow = useCallback((layer: Layer) => {
    setFocusId(layer.id)
  }, [])

  const handleSelect = useCallback((layer: Layer, event: React.MouseEvent) => {
    const { selectedLayerIds, selectLayer, selectLayers } = useCanvasStore.getState()
    if (event.metaKey || event.ctrlKey) {
      selectLayers(
        selectedLayerIds.includes(layer.id)
          ? selectedLayerIds.filter((id) => id !== layer.id)
          : [...selectedLayerIds, layer.id],
      )
    } else {
      anchorId.current = layer.id
      selectLayer(layer.id)
    }
  }, [])

  const handleSelectExclusive = useCallback((layer: Layer) => {
    anchorId.current = layer.id
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

  /* L'entrée du produit, et pas son deuxième geste : la cible arrive avec ses
     captures de simulateur, pas avec l'envie de poser un cadre vide. Le bouton
     ne compose rien — il remplit « Générer les visuels », qui sait déjà
     transformer N captures en N planches complètes. */
  const capturesInput = useRef<HTMLInputElement>(null)

  const toggleLayers = useUIStore((s) => s.toggleLayers)

  const handleAddDevice = useCallback(() => {
    if (!defaultDeviceModel) return
    const { addLayer } = useCanvasStore.getState()
    const layers = getProjectLayers(useProjectStore.getState().project)
    addLayer(createDeviceLayer(defaultDeviceModel, layers.length))
  }, [defaultDeviceModel])

  return (
    // `max-h-full` sans `h-full` : l'îlot s'arrête sous sa dernière ligne et ne
    // défile qu'une fois le plafond du drawer atteint.
    // `aside` et non `div` : c'est un repère de navigation, et le panneau n'en
    // était aucun — la carte du document s'arrêtait à « principal ».
    <DrawerIsland
      titleId="sf-layers-panel-title"
      title="Calques"
      headerExtra={
        <span className="tabular text-2xs text-muted-foreground">{String(layers.length)}</span>
      }
      headerBelow={
        <InputGroup className="mt-2">
          <InputGroupAddon>
            <Search className="size-3.5" strokeWidth={1.5} aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            size="sm"
            value={query}
            onChange={handleQueryChange}
            placeholder="Filtrer…"
            aria-label="Filtrer les calques"
          />
        </InputGroup>
      }
      onClose={toggleLayers}
      closeLabel="Fermer le panneau Calques"
    >
      {/* Les états vides vivent hors de la listbox : une listbox n'a que des
          options (et des groupes) pour enfants exposés, pas un paragraphe et
          un bouton d'appel. */}
      {layers.length === 0 && (
        <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 pb-2 text-center">
          <Smartphone size={20} strokeWidth={1.5} className="text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Écran vide.</p>
          <p className="max-w-[190px] text-2xs text-muted-foreground">
            Partez de vos captures de simulateur, ou composez à la main.
          </p>
          <Input
            unstyled
            nativeInput
            ref={capturesInput}
            type="file"
            multiple
            accept={SCREENSHOT_IMAGE_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const chosen = [...(event.target.files ?? [])]
              event.target.value = ''
              if (chosen.length > 0) useUIStore.getState().openCampaignWithCaptures(chosen)
            }}
          />
          <Button
            variant="default"
            size="sm"
            className="mt-2"
            onClick={() => capturesInput.current?.click()}
          >
            <ImageUp size={12} aria-hidden />
            Partir de mes captures…
          </Button>
          <Button variant="ghost" size="sm" onClick={handleAddDevice}>
            Ajouter un cadre iPhone
          </Button>
        </div>
      )}

      {layers.length > 0 && layerGroups.length === 0 && (
        <Empty role="status" className="min-h-32 gap-0 px-6 py-6">
          <EmptyTitle className="font-normal text-sm">Aucun calque ne correspond</EmptyTitle>
        </Empty>
      )}

      {layerGroups.length > 0 && (
        <ScrollArea
          // Pas de `flex-1` : sa base de 0 effondre la liste dans un conteneur à
          // hauteur automatique. `flex: 0 1 auto` la dimensionne sur son contenu
          // puis la laisse rétrécir — et défiler — une fois le plafond atteint.
          className="px-2 pb-2"
        >
          <div role="listbox" aria-label="Calques" aria-multiselectable>
            {layerGroups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label}>
                {/* `aria-hidden` : le groupe porte déjà ce texte en `aria-label`,
                  et un paragraphe n'est pas un enfant de listbox. */}
                <p aria-hidden className="field-label px-2 pb-2 pt-4">
                  {group.label}
                </p>
                {group.rows.map(({ layer, ghost }) =>
                  ghost ? (
                    /* Fantôme de sortie : hors de l'arbre a11y (`presentation`),
                     inerte — il ne doit ni se lire, ni se focaliser, ni se
                     tirer. Il sort à la place que la ligne occupait. */
                    <div
                      key={`ghost-${layer.id}`}
                      role="presentation"
                      aria-hidden
                      inert
                      className="animate-exit pointer-events-none flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground"
                    >
                      <span className="flex-1 truncate text-sm">{layerDisplayName(layer)}</span>
                    </div>
                  ) : (
                    <LayerItem
                      key={layer.id}
                      layer={layer}
                      isSelected={selectedIds.has(layer.id)}
                      tabIndex={layer.id === activeFocusId ? 0 : -1}
                      onSelect={handleSelect}
                      onSelectExclusive={handleSelectExclusive}
                      onNavigate={handleNavigate}
                      onFocusRow={handleFocusRow}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </DrawerIsland>
  )
}
