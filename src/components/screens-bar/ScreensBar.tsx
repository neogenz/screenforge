import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { ScreenThumbnail } from './ScreenThumbnail'
import { cn } from '@/lib/utils'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'

export function ScreensBar() {
  const { project, addScreen, removeScreen, duplicateScreen, renameScreen, reorderScreens } =
    useProjectStore(
      useShallow((s) => ({
        project: s.project,
        addScreen: s.addScreen,
        removeScreen: s.removeScreen,
        duplicateScreen: s.duplicateScreen,
        renameScreen: s.renameScreen,
        reorderScreens: s.reorderScreens,
      })),
    )

  const { activeScreenId, setActiveScreenId, recordProjectHistory } = useCanvasStore(
    useShallow((s) => ({
      activeScreenId: s.activeScreenId,
      setActiveScreenId: s.setActiveScreenId,
      recordProjectHistory: s.recordProjectHistory,
    })),
  )

  const dragSourceIndex = useRef<number | null>(null)
  const screens = project?.screens ?? []

  function handleClick(screenId: string) {
    if (screenId !== activeScreenId) {
      setActiveScreenId(screenId)
    }
  }

  function handleAddScreen() {
    if (screens.length >= MAX_PROJECT_SCREENS) return
    recordProjectHistory()
    const screenId = addScreen()
    if (screenId) setActiveScreenId(screenId)
  }

  function handleDeleteScreen(id: string) {
    if (screens.length <= 1) return
    recordProjectHistory()
    const nextActiveId = removeScreen(id)
    if (nextActiveId) setActiveScreenId(nextActiveId)
  }

  function handleDuplicateScreen(id: string) {
    if (screens.length >= MAX_PROJECT_SCREENS) return
    recordProjectHistory()
    const duplicateId = duplicateScreen(id)
    if (duplicateId) setActiveScreenId(duplicateId)
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    dragSourceIndex.current = index
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    const sourceIndex = dragSourceIndex.current
    if (sourceIndex === null || sourceIndex === targetIndex) return
    const reordered = [...screens]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    recordProjectHistory()
    reorderScreens(reordered.map((s) => s.id))
    dragSourceIndex.current = null
  }

  function handleMoveScreen(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= screens.length) return
    const reordered = [...screens]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    recordProjectHistory()
    reorderScreens(reordered.map((screen) => screen.id))
  }

  return (
    <div className="flex h-full min-h-0 w-full items-center gap-4 overflow-x-auto border-t border-border bg-panel px-5">
      <span className="mono-value shrink-0 text-[10px] text-muted tabular-nums">
        {screens.length}/{MAX_PROJECT_SCREENS}
      </span>
      {screens.map((screen, index) => (
        <div
          key={screen.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
        >
          <ScreenThumbnail
            screen={screen}
            isActive={screen.id === activeScreenId}
            index={index}
            onClick={() => handleClick(screen.id)}
            canDelete={screens.length > 1}
            canMoveLeft={index > 0}
            canMoveRight={index < screens.length - 1}
            onRename={(name) => renameScreen(screen.id, name)}
            onDuplicate={() => handleDuplicateScreen(screen.id)}
            onDelete={() => handleDeleteScreen(screen.id)}
            onMoveLeft={() => handleMoveScreen(index, -1)}
            onMoveRight={() => handleMoveScreen(index, 1)}
          />
        </div>
      ))}

      <button
        title="Ajouter un écran"
        aria-label="Ajouter un écran"
        onClick={handleAddScreen}
        disabled={screens.length >= MAX_PROJECT_SCREENS}
        type="button"
        className={cn(
          'flex h-[96px] aspect-[9/19.5] shrink-0 items-center justify-center self-center',
          'rounded-sm border border-dashed border-border-strong bg-panel-sub',
          'text-muted transition-colors duration-100 ease-out',
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
