import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Copy, MoreHorizontal, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Screen } from '@/types'

interface ScreenThumbnailProps {
  screen: Screen
  isActive: boolean
  index: number
  canDelete: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onClick: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
}

export function ScreenThumbnail({
  screen,
  isActive,
  index,
  canDelete,
  canMoveLeft,
  canMoveRight,
  onClick,
  onDuplicate,
  onDelete,
  onMoveLeft,
  onMoveRight,
}: ScreenThumbnailProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLButtonElement>(null)

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenuPosition({ left: e.clientX, top: Math.max(8, e.clientY - 150) })
    setMenuOpen(true)
  }

  function toggleMenu() {
    if (!menuOpen) {
      const bounds = actionsRef.current?.getBoundingClientRect()
      if (bounds) {
        setMenuPosition({ left: bounds.right - 8, top: Math.max(8, bounds.top - 150) })
      }
    }
    setMenuOpen((open) => !open)
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onContextMenu={handleContextMenu}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setMenuOpen(false)
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`Activate ${screen.name}`}
        aria-pressed={isActive}
        className={cn(
          'h-[104px] aspect-[9/19.5] cursor-pointer overflow-hidden rounded-md',
          'border transition-colors duration-100 ease-out',
          isActive
            ? 'border-foreground'
            : 'border-border hover:border-border-strong',
        )}
      >
        {screen.thumbnail ? (
          <img
            src={screen.thumbnail}
            alt={screen.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-panel-muted" />
        )}
      </button>

      {/* Index label — Space Mono */}
      <div
        className={cn(
          'pointer-events-none absolute top-1.5 left-1.5 flex h-[16px] min-w-[22px] items-center justify-center px-1',
          'mono-label rounded-sm border border-border',
          isActive ? 'bg-foreground text-panel border-foreground' : 'bg-panel text-foreground-muted',
        )}
      >
        {String(index + 1).padStart(2, '0')}
      </div>

      <button
        ref={actionsRef}
        type="button"
        onClick={toggleMenu}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-panel/90 text-foreground-muted transition-colors hover:text-foreground"
        aria-label={`${screen.name} actions`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={12} strokeWidth={1.5} aria-hidden />
      </button>

      {menuOpen && createPortal(
        <div
          className={cn(
            'fixed z-[100] min-w-[170px] -translate-x-full rounded-md border border-border bg-panel p-1',
            'animate-[fade-in_0.14s_ease-out]',
          )}
          role="menu"
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation()
              onDuplicate()
              setMenuOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-foreground transition-colors hover:bg-surface-hover"
          >
            <Copy size={11} strokeWidth={1.5} />
            Dupliquer
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation()
              onMoveLeft()
              setMenuOpen(false)
            }}
            disabled={!canMoveLeft}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-foreground transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft size={11} strokeWidth={1.5} aria-hidden />
            Déplacer à gauche
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation()
              onMoveRight()
              setMenuOpen(false)
            }}
            disabled={!canMoveRight}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-foreground transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight size={11} strokeWidth={1.5} aria-hidden />
            Déplacer à droite
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
              setMenuOpen(false)
            }}
            disabled={!canDelete}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-danger transition-colors hover:bg-danger-soft disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 size={11} strokeWidth={1.5} />
            Supprimer
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
