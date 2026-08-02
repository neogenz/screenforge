import { memo, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { cn } from '@/lib/utils'
import { THUMBNAIL_HEIGHT } from '@/lib/stage'
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
      className="group/thumb relative flex shrink-0 flex-col gap-1"
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
        style={{ height: THUMBNAIL_HEIGHT }}
        className={cn(
          'aspect-[1320/2868] cursor-pointer overflow-hidden rounded-md bg-inset',
          'border transition-[border-color,box-shadow,transform] duration-150 ease-out',
          'active:scale-[0.97]',
          // L'écran actif se signale par un contraste de valeur : bordure claire
          // doublée d'un anneau, jamais par une couleur.
          isActive
            ? 'border-foreground shadow-[0_0_0_2px_var(--color-raised-active)]'
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
          <div className="h-full w-full bg-raised" />
        )}
      </button>

      {/* Le numéro vit sous la vignette, pas dessus : à cette largeur une pastille
          posée sur l'image en masquait le quart. */}
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
          className="field-surface h-[18px] w-full px-1 text-center text-[10px] text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(screen.id)}
          onDoubleClick={startRename}
          title={`${screen.name} — double-clic pour renommer`}
          className={cn(
            'flex h-[18px] w-full items-center justify-center gap-1 rounded-[4px] px-0.5',
            'text-[10px] leading-none transition-colors',
            isActive ? 'text-foreground' : 'text-faint hover:text-foreground-muted',
          )}
        >
          <span className="tabular shrink-0 opacity-60">{String(index + 1).padStart(2, '0')}</span>
          <span className="truncate">{screen.name}</span>
        </button>
      )}

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
          'hit-40 absolute right-1 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-[4px]',
          'border border-border bg-panel/95 text-foreground-muted transition-opacity hover:text-foreground',
          !menuPosition &&
            'pointer-events-none opacity-0 focus:pointer-events-auto focus:opacity-100 group-hover/thumb:pointer-events-auto group-hover/thumb:opacity-100',
        )}
        aria-label={`Actions de ${screen.name}`}
        aria-expanded={menuPosition !== null}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={11} strokeWidth={1.75} aria-hidden />
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
