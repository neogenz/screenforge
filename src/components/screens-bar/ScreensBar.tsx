import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { ScreenThumbnail } from './ScreenThumbnail'

const MAX_SCREENS = 10

export function ScreensBar() {
  const { project, addScreen, removeScreen, duplicateScreen, reorderScreens } =
    useProjectStore(
      useShallow((s) => ({
        project: s.project,
        addScreen: s.addScreen,
        removeScreen: s.removeScreen,
        duplicateScreen: s.duplicateScreen,
        reorderScreens: s.reorderScreens,
      })),
    )

  const { activeScreenId, setActiveScreenId } = useCanvasStore(
    useShallow((s) => ({
      activeScreenId: s.activeScreenId,
      setActiveScreenId: s.setActiveScreenId,
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
    if (screens.length >= MAX_SCREENS) return
    addScreen()
  }

  function handleDeleteScreen(id: string) {
    if (screens.length <= 1) return
    if (id === activeScreenId) {
      const other = screens.find((s) => s.id !== id)
      if (other) setActiveScreenId(other.id)
    }
    removeScreen(id)
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
    reorderScreens(reordered.map((s) => s.id))
    dragSourceIndex.current = null
  }

  return (
    <div className="flex h-full min-h-0 w-full items-center gap-4 overflow-x-auto bg-panel px-8 py-3">
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
            onDuplicate={() => duplicateScreen(screen.id)}
            onDelete={() => handleDeleteScreen(screen.id)}
          />
        </div>
      ))}

      <button
        title="Add screen"
        aria-label="Add new screen"
        onClick={handleAddScreen}
        disabled={screens.length >= MAX_SCREENS}
        className="flex h-24 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/10 transition-colors hover:border-primary/50 disabled:pointer-events-none disabled:opacity-30"
      >
        <Plus size={18} className="text-muted" />
      </button>
    </div>
  )
}
