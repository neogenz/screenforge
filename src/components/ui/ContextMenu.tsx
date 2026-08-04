import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

/** A menu entry is either an actionable item or a visual separator. */
export type ContextMenuEntry = ContextMenuItem | 'separator'

interface ContextMenuProps {
  position: { left: number; top: number }
  label: string
  items: ContextMenuEntry[]
  onClose: () => void
}

const MENU_WIDTH = 200
const ITEM_HEIGHT = 28
const SEPARATOR_HEIGHT = 9

function estimatedHeight(items: ContextMenuEntry[]): number {
  return items.reduce(
    (total, item) => total + (item === 'separator' ? SEPARATOR_HEIGHT : ITEM_HEIGHT),
    10,
  )
}

export function ContextMenu({ position, label, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('[data-context-menu]')) onClose()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // Keep the window-level shortcut handler from also clearing the selection.
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const left = Math.max(8, Math.min(position.left, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(position.top, window.innerHeight - estimatedHeight(items) - 8))

  return createPortal(
    <div
      data-context-menu
      role="menu"
      aria-label={label}
      className={cn(
        'menu-shadow fixed z-(--z-popover) min-w-[180px] rounded-lg border border-border bg-panel p-1',
        'animate-menu-in origin-top',
      )}
      style={{ left, top }}
    >
      {items.map((item, index) =>
        item === 'separator' ? (
          <div key={`separator-${index}`} role="separator" className="mx-1 my-1 h-px bg-border" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={(event) => {
              event.stopPropagation()
              item.onSelect()
              onClose()
            }}
            className={cn(
              'flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left text-[12.5px] transition-colors',
              'disabled:pointer-events-none disabled:opacity-40',
              item.danger ? 'text-danger hover:bg-danger-soft' : 'text-foreground hover:bg-raised-hover',
            )}
          >
            {item.icon && <span className="shrink-0 text-faint" aria-hidden>{item.icon}</span>}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.shortcut && (
              <span className="tabular ml-auto pl-4 text-[10px] text-faint">{item.shortcut}</span>
            )}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
