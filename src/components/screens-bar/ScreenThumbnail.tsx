import { memo, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { cn } from '@/lib/utils'
import type { Screen } from '@/types'

interface ScreenThumbnailProps {
  screen: Screen
  isActive: boolean
  index: number
  canDelete: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onMove: (index: number, direction: -1 | 1) => void
}

export const ScreenThumbnail = memo(function ScreenThumbnail({
  screen,
  isActive,
  index,
  canDelete,
  canMoveLeft,
  canMoveRight,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
}: ScreenThumbnailProps) {
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(screen.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const actionsRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => inputRef.current?.select())
    return () => cancelAnimationFrame(frame)
  }, [editing])

  function startRename() {
    setDraftName(screen.name)
    setEditing(true)
  }

  function commitRename() {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== screen.name) onRename(screen.id, trimmed)
    setEditing(false)
  }

  return (
    <div
      className="relative flex shrink-0 flex-col items-center gap-1"
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuPosition({ left: event.clientX, top: event.clientY })
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(screen.id)}
        onDoubleClick={startRename}
        aria-label={`Activer ${screen.name}`}
        aria-pressed={isActive}
        className={cn(
          'h-[92px] aspect-[9/19.5] cursor-pointer overflow-hidden rounded-md',
          'border transition-[border-color,transform] duration-150 ease-out active:scale-[0.96]',
          isActive
            ? 'border-export ring-1 ring-export'
            : 'border-border hover:border-border-strong',
        )}
      >
        {screen.thumbnail ? (
          <img
            src={screen.thumbnail}
            alt={screen.name}
            className="img-outline h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-surface" />
        )}
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename()
            if (event.key === 'Escape') setEditing(false)
          }}
          aria-label="Nom de l’écran"
          spellCheck={false}
          className="h-5 w-20 rounded-md border border-border-strong bg-panel px-1 text-center text-[10px] text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(screen.id)}
          onDoubleClick={startRename}
          title={`${screen.name} — double-clic pour renommer`}
          className={cn(
            'h-4 max-w-24 truncate px-1 text-[10px] leading-4 transition-colors',
            isActive ? 'text-foreground' : 'text-faint hover:text-foreground',
          )}
        >
          {screen.name}
        </button>
      )}

      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-1 top-1 flex h-[15px] min-w-[20px] items-center justify-center px-1',
          'caps-label rounded-[4px] border',
          isActive
            ? 'border-export bg-export text-on-export'
            : 'border-border bg-panel/90 text-foreground-muted',
        )}
      >
        {String(index + 1).padStart(2, '0')}
      </div>

      <button
        ref={actionsRef}
        type="button"
        onClick={() => {
          if (menuPosition) setMenuPosition(null)
          else {
            const bounds = actionsRef.current?.getBoundingClientRect()
            if (bounds) setMenuPosition({ left: bounds.right - 180, top: bounds.top - 150 })
          }
        }}
        className={cn(
          'hit-40 absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md',
          'border border-border bg-panel/90 text-foreground-muted transition-colors hover:text-foreground',
          !menuPosition && 'opacity-0 focus:opacity-100 [div:hover>&]:opacity-100',
        )}
        aria-label={`Actions de ${screen.name}`}
        aria-expanded={menuPosition !== null}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={12} strokeWidth={1.5} aria-hidden />
      </button>

      {menuPosition && (
        <ContextMenu
          position={menuPosition}
          label={`Actions de ${screen.name}`}
          onClose={() => setMenuPosition(null)}
          items={[
            { label: 'Renommer', icon: <Pencil size={11} strokeWidth={1.5} aria-hidden />, onSelect: startRename },
            { label: 'Dupliquer', icon: <Copy size={11} strokeWidth={1.5} aria-hidden />, onSelect: () => onDuplicate(screen.id) },
            { label: 'Déplacer à gauche', icon: <ChevronLeft size={11} strokeWidth={1.5} aria-hidden />, disabled: !canMoveLeft, onSelect: () => onMove(index, -1) },
            { label: 'Déplacer à droite', icon: <ChevronRight size={11} strokeWidth={1.5} aria-hidden />, disabled: !canMoveRight, onSelect: () => onMove(index, 1) },
            { label: 'Supprimer', icon: <Trash2 size={11} strokeWidth={1.5} aria-hidden />, danger: true, disabled: !canDelete, onSelect: () => onDelete(screen.id) },
          ]}
        />
      )}
    </div>
  )
})
