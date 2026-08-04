import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { toast } from '@/stores/toast.store'
import { ScreenThumbnail } from './ScreenThumbnail'
import { cn } from '@/lib/utils'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import { FILMSTRIP_HEIGHT, THUMBNAIL_HEIGHT } from '@/lib/stage'
import type { Background } from '@/types'

/** Floating bottom-center screens strip. */
export function ScreensBar() {
  const { screens, activeScreenId } = useProjectStore(useShallow((state) => ({
    screens: state.project?.screens,
    activeScreenId: state.project?.activeScreenId ?? '',
  })))
  const list = screens ?? []
  const atCapacity = list.length >= MAX_PROJECT_SCREENS
  const dragSourceIndex = useRef<number | null>(null)
  const [copiedSettings, setCopiedSettings] = useState<Background | null>(null)

  const handleSelect = useCallback((id: string) => {
    const project = useProjectStore.getState().project
    if (id === project?.activeScreenId) return
    useProjectStore.getState().setActiveScreenId(id)
    useCanvasStore.getState().clearSelection()
  }, [])

  const handleAdd = useCallback(() => {
    const project = useProjectStore.getState().project
    if (!project || project.screens.length >= MAX_PROJECT_SCREENS) return
    useCanvasStore.getState().recordProjectHistory()
    if (useProjectStore.getState().addScreen()) useCanvasStore.getState().clearSelection()
  }, [])

  const handleRename = useCallback((id: string, name: string) => {
    useProjectStore.getState().renameScreen(id, name)
  }, [])

  const handleDuplicate = useCallback((id: string) => {
    const project = useProjectStore.getState().project
    if (!project || project.screens.length >= MAX_PROJECT_SCREENS) return
    useCanvasStore.getState().recordProjectHistory()
    if (useProjectStore.getState().duplicateScreen(id)) useCanvasStore.getState().clearSelection()
  }, [])

  const handleDelete = useCallback((id: string) => {
    const project = useProjectStore.getState().project
    if (!project || project.screens.length <= 1) return
    useCanvasStore.getState().recordProjectHistory()
    if (useProjectStore.getState().removeScreen(id)) useCanvasStore.getState().clearSelection()
  }, [])

  const handleCopySettings = useCallback((id: string) => {
    const screen = useProjectStore.getState().project?.screens.find((candidate) => candidate.id === id)
    if (!screen) return
    setCopiedSettings(structuredClone(screen.background))
    toast(`Réglages de ${screen.name} copiés.`, 'success')
  }, [])

  const handlePasteSettings = useCallback((id: string) => {
    if (!copiedSettings) return
    const screen = useProjectStore.getState().project?.screens.find((candidate) => candidate.id === id)
    if (!screen) return
    if (JSON.stringify(screen.background) === JSON.stringify(copiedSettings)) {
      toast(`${screen.name} utilise déjà ces réglages.`)
      return
    }
    useCanvasStore.getState().recordProjectHistory()
    useProjectStore.getState().updateScreenBackground(id, copiedSettings)
    toast(`Réglages appliqués à ${screen.name}.`, 'success')
  }, [copiedSettings])

  const handleMove = useCallback((index: number, direction: -1 | 1) => {
    const project = useProjectStore.getState().project
    if (!project) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= project.screens.length) return
    const reordered = [...project.screens]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    useCanvasStore.getState().recordProjectHistory()
    useProjectStore.getState().reorderScreens(reordered.map((screen) => screen.id))
  }, [])

  const handleDragStart = useCallback((index: number, event: React.DragEvent) => {
    dragSourceIndex.current = index
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((index: number, event: React.DragEvent) => {
    event.preventDefault()
    const sourceIndex = dragSourceIndex.current
    dragSourceIndex.current = null
    if (sourceIndex === null || sourceIndex === index) return
    const project = useProjectStore.getState().project
    if (!project) return
    const reordered = [...project.screens]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(index, 0, moved)
    useCanvasStore.getState().recordProjectHistory()
    useProjectStore.getState().reorderScreens(reordered.map((screen) => screen.id))
  }, [])

  return (
    <div
      role="listbox"
      aria-label="Écrans"
      style={{ height: FILMSTRIP_HEIGHT }}
      className="island flex max-w-[min(760px,58vw)] animate-slide-up items-center gap-2.5 overflow-x-auto px-2.5"
    >
      {list.map((screen, index) => (
        <div
          key={screen.id}
          draggable
          onDragStart={(event) => handleDragStart(index, event)}
          onDragOver={handleDragOver}
          onDrop={(event) => handleDrop(index, event)}
        >
          <ScreenThumbnail
            screen={screen}
            isActive={screen.id === activeScreenId}
            index={index}
            canDelete={list.length > 1}
            canMoveLeft={index > 0}
            canMoveRight={index < list.length - 1}
            onSelect={handleSelect}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            canPasteSettings={copiedSettings !== null}
            onCopySettings={handleCopySettings}
            onPasteSettings={handlePasteSettings}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        </div>
      ))}

      {/* Le bouton d'ajout prend la surface des vignettes : un contour en tirets
          le faisait lire comme un emplacement vide, pas comme une action. */}
      <button
        title={atCapacity ? `Maximum ${MAX_PROJECT_SCREENS} écrans` : 'Ajouter un écran'}
        aria-label="Ajouter un écran"
        onClick={handleAdd}
        disabled={atCapacity}
        type="button"
        style={{ height: THUMBNAIL_HEIGHT }}
        className={cn(
          'mb-[26px] flex aspect-[1320/2868] shrink-0 items-center justify-center self-center',
          'rounded-sm border border-border bg-secondary',
          'text-muted-foreground transition-colors duration-150 ease-out',
          'hover:border-input hover:bg-accent hover:text-foreground',
          'disabled:pointer-events-none disabled:opacity-30',
        )}
      >
        <Plus size={16} strokeWidth={1.75} />
      </button>

      {/* Le compteur n'apparaît qu'à l'approche de la limite : ailleurs il
          n'informe de rien que la rangée ne montre déjà. */}
      {list.length >= MAX_PROJECT_SCREENS - 1 && (
        <span className="tabular mb-[26px] shrink-0 self-center px-1 text-[10.5px] text-muted-foreground">
          {list.length}/{MAX_PROJECT_SCREENS}
        </span>
      )}
    </div>
  )
}
