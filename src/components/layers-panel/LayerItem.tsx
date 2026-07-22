import { useRef, useState } from 'react'
import {
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  Lock,
  Smartphone,
  Square,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Layer } from '@/types'

interface LayerItemProps {
  layer: Layer
  isSelected: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveForward: () => void
  onMoveBackward: () => void
  onDragStart: (event: React.DragEvent) => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: (event: React.DragEvent) => void
}

function LayerTypeIcon({ type }: { type: Layer['type'] }) {
  const className = 'shrink-0'
  switch (type) {
    case 'text': return <Type size={12} strokeWidth={1.5} className={className} aria-hidden />
    case 'device-frame': return <Smartphone size={12} strokeWidth={1.5} className={className} aria-hidden />
    case 'image': return <ImageIcon size={12} strokeWidth={1.5} className={className} aria-hidden />
    default: return <Square size={12} strokeWidth={1.5} className={className} aria-hidden />
  }
}

export function LayerItem({
  layer,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onDuplicate,
  onDelete,
  onMoveForward,
  onMoveBackward,
  onDragStart,
  onDragOver,
  onDrop,
}: LayerItemProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(layer.name)
  const inputRef = useRef<HTMLInputElement>(null)

  function startRename() {
    setEditName(layer.name)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  function commitRename() {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== layer.name) onRename(trimmed)
    setEditing(false)
  }

  function handleRenameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commitRename()
    if (event.key === 'Escape') setEditing(false)
  }

  function handleItemKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    } else if (event.key === 'F2') {
      event.preventDefault()
      startRename()
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()
      onDelete()
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      event.stopPropagation()
      onDuplicate()
    } else if (event.altKey && event.key === 'ArrowUp') {
      event.preventDefault()
      onMoveForward()
    } else if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault()
      onMoveBackward()
    }
  }

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`${layer.name}, ${layer.type}`}
      data-layer-id={layer.id}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      onKeyDown={handleItemKeyDown}
      className={cn(
        'group flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-sm px-2',
        'transition-colors duration-100 ease-out focus-visible:ring-1 focus-visible:ring-border-strong',
        isSelected
          ? 'bg-surface-active text-foreground'
          : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground',
      )}
    >
      <LayerTypeIcon type={layer.type} />

      {editing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(event) => setEditName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKeyDown}
          onClick={(event) => event.stopPropagation()}
          aria-label="Layer name"
          className="min-w-0 flex-1 rounded-sm border border-border bg-panel px-1.5 py-1 text-[12px] outline-none focus:border-foreground-muted"
        />
      ) : (
        <span
          className="flex-1 truncate text-[12px]"
          onDoubleClick={(event) => {
            event.stopPropagation()
            startRename()
          }}
        >
          {layer.name}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <LayerAction
          label={layer.visible ? 'Hide layer' : 'Show layer'}
          onClick={onToggleVisibility}
        >
          {layer.visible
            ? <Eye size={11} strokeWidth={1.5} aria-hidden />
            : <EyeOff size={11} strokeWidth={1.5} aria-hidden />}
        </LayerAction>
        <LayerAction
          label={layer.locked ? 'Unlock layer' : 'Lock layer'}
          onClick={onToggleLock}
        >
          {layer.locked
            ? <Lock size={11} strokeWidth={1.5} aria-hidden />
            : <Unlock size={11} strokeWidth={1.5} aria-hidden />}
        </LayerAction>
        <LayerAction label="Duplicate layer" onClick={onDuplicate}>
          <Copy size={11} strokeWidth={1.5} aria-hidden />
        </LayerAction>
        <LayerAction label="Delete layer" danger onClick={onDelete}>
          <Trash2 size={11} strokeWidth={1.5} aria-hidden />
        </LayerAction>
      </div>

      {(!layer.visible || layer.locked) && (
        <div className="flex shrink-0 items-center gap-0.5 group-focus-within:hidden group-hover:hidden" aria-hidden>
          {!layer.visible && <EyeOff size={10} strokeWidth={1.5} className="text-faint" />}
          {layer.locked && <Lock size={10} strokeWidth={1.5} className="text-faint" />}
        </div>
      )}
    </div>
  )
}

function LayerAction({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-sm text-muted transition-colors',
        danger ? 'hover:bg-surface-hover hover:text-danger' : 'hover:bg-surface-hover hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
