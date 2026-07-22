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
      </div>

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

      {menuOpen && (
        <div
          className={cn(
            'absolute bottom-full left-0 z-50 mb-2 min-w-[140px] rounded-md border border-border bg-panel p-1',
            'animate-[fade-in_0.14s_ease-out]',
          )}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={() => handleMenuAction(onDuplicate)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-foreground transition-colors hover:bg-surface-hover"
          >
            <Copy size={11} strokeWidth={1.5} />
            Dupliquer
          </button>
          <button
            onClick={() => handleMenuAction(onDelete)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-danger transition-colors hover:bg-danger-soft"
          >
            <Trash2 size={11} strokeWidth={1.5} />
            Supprimer
          </button>
        </div>
      )}
    </div>
  )
}
