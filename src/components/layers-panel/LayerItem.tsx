import { useState, useRef } from 'react'
import { Type, Smartphone, ImageIcon, Square, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
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
  const cls = 'shrink-0'
  switch (type) {
    case 'text': return <Type size={12} strokeWidth={1.5} className={cls} />
    case 'device-frame': return <Smartphone size={12} strokeWidth={1.5} className={cls} />
    case 'image': return <ImageIcon size={12} strokeWidth={1.5} className={cls} />
    case 'shape': return <Square size={12} strokeWidth={1.5} className={cls} />
    default: return <Square size={12} strokeWidth={1.5} className={cls} />
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
        'group flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 select-none',
        'transition-colors duration-100 ease-out',
        // Nothing: selection = border hairline, not color fill
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
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'min-w-0 flex-1 rounded-sm border border-border bg-panel px-1.5 py-0.5 text-[12px] outline-none',
            'focus:border-foreground-muted',
          )}
        />
      ) : (
        <span
          className="flex-1 truncate text-[12px]"
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
            'flex h-6 w-6 items-center justify-center rounded-sm text-muted transition-colors',
            'hover:bg-surface-hover hover:text-foreground',
            !layer.visible && 'text-faint',
          )}
        >
          {layer.visible ? <Eye size={11} strokeWidth={1.5} /> : <EyeOff size={11} strokeWidth={1.5} />}
        </button>
        <button
          aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
          title={layer.locked ? 'Unlock' : 'Lock'}
          onClick={(e) => { e.stopPropagation(); onToggleLock() }}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-sm text-muted transition-colors',
            'hover:bg-surface-hover hover:text-foreground',
            layer.locked && 'text-foreground',
          )}
        >
          {layer.locked ? <Lock size={11} strokeWidth={1.5} /> : <Unlock size={11} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Always-visible indicators when toggled */}
      {(!layer.visible || layer.locked) && (
        <div className="flex shrink-0 items-center gap-0.5 group-hover:hidden">
          {!layer.visible && <EyeOff size={10} strokeWidth={1.5} className="text-faint" />}
          {layer.locked && <Lock size={10} strokeWidth={1.5} className="text-faint" />}
        </div>
      )}
    </div>
  )
}
