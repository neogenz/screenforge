import { useState, useRef } from 'react'
import { GripVertical, Type, Smartphone, ImageIcon, Square, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Layer } from '@/types'

interface LayerItemProps {
  layer: Layer
  isSelected: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onRename: (name: string) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

function LayerTypeIcon({ type }: { type: Layer['type'] }) {
  const cls = 'shrink-0 text-muted/80'
  switch (type) {
    case 'text': return <Type size={13} strokeWidth={1.75} className={cls} />
    case 'device-frame': return <Smartphone size={13} strokeWidth={1.75} className={cls} />
    case 'image': return <ImageIcon size={13} strokeWidth={1.75} className={cls} />
    case 'shape': return <Square size={13} strokeWidth={1.75} className={cls} />
    default: return <Square size={13} strokeWidth={1.75} className={cls} />
  }
}

export function LayerItem({
  layer,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onDragStart,
  onDragOver,
  onDrop,
}: LayerItemProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(layer.name)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDoubleClick() {
    setEditName(layer.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitRename() {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== layer.name) {
      onRename(trimmed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={cn(
        'group flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 select-none',
        isSelected
          ? 'bg-primary/10 text-foreground'
          : 'text-foreground/90 hover:bg-surface-hover/70',
      )}
    >
      <GripVertical size={12} strokeWidth={1.75} className="shrink-0 cursor-grab text-muted/50 opacity-0 group-hover:opacity-100 active:cursor-grabbing" />
      <LayerTypeIcon type={layer.type} />

      {editing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded border border-primary bg-panel px-1.5 py-0.5 text-[11px] outline-none ring-1 ring-primary/20"
        />
      ) : (
        <span
          className="flex-1 truncate text-[11px] font-medium"
          onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick() }}
        >
          {layer.name}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
          title={layer.visible ? 'Hide' : 'Show'}
          onClick={(e) => { e.stopPropagation(); onToggleVisibility() }}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-surface hover:text-foreground',
            !layer.visible && 'opacity-100 text-muted/50',
          )}
        >
          {layer.visible ? <Eye size={12} strokeWidth={1.75} /> : <EyeOff size={12} strokeWidth={1.75} />}
        </button>
        <button
          aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
          title={layer.locked ? 'Unlock' : 'Lock'}
          onClick={(e) => { e.stopPropagation(); onToggleLock() }}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-surface hover:text-foreground',
            layer.locked && 'opacity-100 text-primary/70',
          )}
        >
          {layer.locked ? <Lock size={12} strokeWidth={1.75} /> : <Unlock size={12} strokeWidth={1.75} />}
        </button>
      </div>

      {/* Always-visible indicators when toggled */}
      {(!layer.visible || layer.locked) && (
        <div className="flex shrink-0 items-center gap-0.5 group-hover:hidden">
          {!layer.visible && <EyeOff size={11} strokeWidth={1.75} className="text-muted/40" />}
          {layer.locked && <Lock size={11} strokeWidth={1.75} className="text-primary/50" />}
        </div>
      )}
    </div>
  )
}
