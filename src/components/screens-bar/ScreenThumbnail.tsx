import { useState, useRef } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Screen } from '@/types'

interface ScreenThumbnailProps {
  screen: Screen
  isActive: boolean
  index: number
  onClick: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function ScreenThumbnail({
  screen,
  isActive,
  index,
  onClick,
  onDuplicate,
  onDelete,
}: ScreenThumbnailProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenuOpen(true)
  }

  function handleMenuAction(action: () => void) {
    action()
    setMenuOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onContextMenu={handleContextMenu}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setMenuOpen(false)
        }
      }}
    >
      <div
        onClick={onClick}
        className={cn(
          'h-24 aspect-[440/956] cursor-pointer overflow-hidden rounded-lg transition-all',
          isActive
            ? 'ring-2 ring-primary shadow-[0_0_12px_rgba(99,102,241,0.25)]'
            : 'ring-1 ring-white/[0.08] hover:ring-white/20',
        )}
      >
        {screen.thumbnail ? (
          <img
            src={screen.thumbnail}
            alt={screen.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-surface to-canvas-bg" />
        )}
      </div>

      <div className="pointer-events-none absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-foreground/80 backdrop-blur-sm">
        {index + 1}
      </div>

      {menuOpen && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 min-w-[140px] rounded-lg border border-white/[0.08] bg-panel py-1.5 shadow-xl backdrop-blur-xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={() => handleMenuAction(onDuplicate)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface-hover"
          >
            <Copy size={13} />
            Dupliquer
          </button>
          <button
            onClick={() => handleMenuAction(onDelete)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-danger transition-colors hover:bg-surface-hover"
          >
            <Trash2 size={13} />
            Supprimer
          </button>
        </div>
      )}
    </div>
  )
}
