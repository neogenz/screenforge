import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
  onRename: (name: string) => void
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
  onRename,
  onDuplicate,
  onDelete,
  onMoveLeft,
  onMoveRight,
}: ScreenThumbnailProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 })
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(screen.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const actionsRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => inputRef.current?.select())
    return () => cancelAnimationFrame(frame)
  }, [editing])

  function openMenu(at?: { left: number; top: number }) {
    if (at) setMenuPosition(at)
    else {
      const bounds = actionsRef.current?.getBoundingClientRect()
      if (bounds) setMenuPosition({ left: bounds.right - 8, top: Math.max(8, bounds.top - 170) })
    }
    setMenuOpen(true)
  }

  function startRename() {
    setDraftName(screen.name)
    setEditing(true)
  }

  function commitRename() {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== screen.name) onRename(trimmed)
    setEditing(false)
  }

  return (
    <div
      className="relative flex shrink-0 flex-col items-center gap-1.5"
      onContextMenu={(event) => {
        event.preventDefault()
        openMenu({ left: event.clientX, top: Math.max(8, event.clientY - 170) })
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setMenuOpen(false)
      }}
    >
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={startRename}
        aria-label={`Activer ${screen.name}`}
        aria-pressed={isActive}
        className={cn(
          'h-[96px] aspect-[9/19.5] cursor-pointer overflow-hidden rounded-sm',
          'border transition-colors duration-100 ease-out',
          isActive
            ? 'border-primary ring-1 ring-primary'
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
          className="h-5 w-20 rounded-sm border border-border-strong bg-panel px-1 text-center text-[10px] text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onClick}
          onDoubleClick={startRename}
          title={`${screen.name} — double-clic pour renommer`}
          className={cn(
            'h-5 max-w-24 truncate px-1 text-[10px] leading-5 transition-colors',
            isActive ? 'text-foreground' : 'text-muted hover:text-foreground',
          )}
        >
          {screen.name}
        </button>
      )}

      <div
        className={cn(
          'pointer-events-none absolute left-1 top-1 flex h-[15px] min-w-[20px] items-center justify-center px-1',
          'mono-label rounded-sm border',
          isActive
            ? 'border-primary bg-primary text-white'
            : 'border-border bg-panel/90 text-foreground-muted',
        )}
      >
        {String(index + 1).padStart(2, '0')}
      </div>

      <button
        ref={actionsRef}
        type="button"
        onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
        className={cn(
          'absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-sm',
          'border border-border bg-panel/90 text-foreground-muted transition-colors hover:text-foreground',
          !menuOpen && 'opacity-0 focus:opacity-100 [div:hover>&]:opacity-100',
        )}
        aria-label={`Actions de ${screen.name}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={12} strokeWidth={1.5} aria-hidden />
      </button>

      {menuOpen && createPortal(
        <div
          className={cn(
            'fixed z-[100] min-w-[180px] -translate-x-full rounded-md border border-border bg-panel p-1',
            'animate-[fade-in_0.14s_ease-out]',
          )}
          role="menu"
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          <MenuItem
            onClick={() => {
              startRename()
              setMenuOpen(false)
            }}
          >
            <Pencil size={11} strokeWidth={1.5} aria-hidden />
            Renommer
          </MenuItem>
          <MenuItem
            onClick={() => {
              onDuplicate()
              setMenuOpen(false)
            }}
          >
            <Copy size={11} strokeWidth={1.5} aria-hidden />
            Dupliquer
          </MenuItem>
          <MenuItem
            disabled={!canMoveLeft}
            onClick={() => {
              onMoveLeft()
              setMenuOpen(false)
            }}
          >
            <ChevronLeft size={11} strokeWidth={1.5} aria-hidden />
            Déplacer à gauche
          </MenuItem>
          <MenuItem
            disabled={!canMoveRight}
            onClick={() => {
              onMoveRight()
              setMenuOpen(false)
            }}
          >
            <ChevronRight size={11} strokeWidth={1.5} aria-hidden />
            Déplacer à droite
          </MenuItem>
          <MenuItem
            disabled={!canDelete}
            danger
            onClick={() => {
              onDelete()
              setMenuOpen(false)
            }}
          >
            <Trash2 size={11} strokeWidth={1.5} aria-hidden />
            Supprimer
          </MenuItem>
        </div>,
        document.body,
      )}
    </div>
  )
}

function MenuItem({
  danger = false,
  disabled = false,
  onClick,
  children,
}: {
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        danger ? 'text-danger hover:bg-danger-soft' : 'text-foreground hover:bg-surface-hover',
      )}
    >
      {children}
    </button>
  )
}
