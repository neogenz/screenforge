import { useCallback, useRef } from 'react'
import { Plus } from 'lucide-react'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { ScreenThumbnail } from './ScreenThumbnail'
import { cn } from '@/lib/utils'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'

/** Floating bottom-center screens strip. */
export function ScreensBar() {
  const screens = useProjectStore((s) => s.project?.screens)
  const activeScreenId = useCanvasStore((s) => s.activeScreenId)
  const list = screens ?? []
  const dragSourceIndex = useRef<number | null>(null)

  const handleSelect = useCallback((id: string) => {
    const { activeScreenId: current, setActiveScreenId } = useCanvasStore.getState()
    if (id !== current) setActiveScreenId(id)
  }, [])

  const handleAdd = useCallback(() => {
    const project = useProjectStore.getState().project
    if (!project || project.screens.length >= MAX_PROJECT_SCREENS) return
    useCanvasStore.getState().recordProjectHistory()
    const screenId = useProjectStore.getState().addScreen()
    if (screenId) useCanvasStore.getState().setActiveScreenId(screenId)
  }, [])

  const handleRename = useCallback((id: string, name: string) => {
    useProjectStore.getState().renameScreen(id, name)
  }, [])

  const handleDuplicate = useCallback((id: string) => {
    const project = useProjectStore.getState().project
    if (!project || project.screens.length >= MAX_PROJECT_SCREENS) return
    useCanvasStore.getState().recordProjectHistory()
    const duplicateId = useProjectStore.getState().duplicateScreen(id)
    if (duplicateId) useCanvasStore.getState().setActiveScreenId(duplicateId)
  }, [])

  const handleDelete = useCallback((id: string) => {
    const project = useProjectStore.getState().project
    if (!project || project.screens.length <= 1) return
    useCanvasStore.getState().recordProjectHistory()
    const nextActiveId = useProjectStore.getState().removeScreen(id)
    if (nextActiveId) useCanvasStore.getState().setActiveScreenId(nextActiveId)
  }, [])

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
      className="island flex h-[132px] max-w-[min(760px,58vw)] animate-slide-up items-center gap-2 overflow-x-auto px-2.5"
    >
      <span className="mono-value shrink-0 px-1 text-[10px] text-muted tabular-nums">
        {list.length}/{MAX_PROJECT_SCREENS}
      </span>
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
            onDelete={handleDelete}
            onMove={handleMove}
          />
        </div>
      ))}

      <button
        title="Ajouter un écran"
        aria-label="Ajouter un écran"
        onClick={handleAdd}
        disabled={list.length >= MAX_PROJECT_SCREENS}
        type="button"
        className={cn(
          'flex aspect-[9/19.5] h-[92px] shrink-0 items-center justify-center self-center',
          'rounded-md border border-dashed border-border-strong bg-panel-sub',
          'text-muted transition-colors duration-150 ease-out',
          'hover:border-foreground hover:text-foreground',
          'disabled:pointer-events-none disabled:opacity-30',
          'focus-visible:outline-none focus-visible:border-foreground',
        )}
      >
        <Plus size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
