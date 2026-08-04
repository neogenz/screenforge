import { createPortal } from 'react-dom'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
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

/** Free-position menu (canvas right-click), clamped to the viewport by the Radix popper. */
export function ContextMenu({ position, label, items, onClose }: ContextMenuProps) {
  return (
    <DropdownMenuPrimitive.Root
      open
      modal={false}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      {createPortal(
        // Trigger invisible porté à body : un `position: fixed` dans l'arbre
        // serait piégé par un ancêtre transformé (filmstrip, drawers).
        <DropdownMenuPrimitive.Trigger asChild>
          <span
            className="pointer-events-none fixed"
            style={{ left: position.left, top: position.top, width: 0, height: 0 }}
          />
        </DropdownMenuPrimitive.Trigger>,
        document.body,
      )}
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          data-context-menu
          aria-label={label}
          align="start"
          side="bottom"
          sideOffset={0}
          collisionPadding={8}
          loop
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            // Keep the window-level shortcut handler from also clearing the selection.
            event.stopPropagation()
          }}
          className={cn(
            'menu-shadow z-(--z-popover) min-w-[180px] animate-menu-in origin-top overflow-hidden rounded-lg border border-border bg-panel p-1',
          )}
        >
          {items.map((item, index) =>
            item === 'separator' ? (
              <DropdownMenuPrimitive.Separator
                key={`separator-${index}`}
                className="mx-1 my-1 h-px bg-border"
              />
            ) : (
              <DropdownMenuPrimitive.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={() => item.onSelect()}
                className={cn(
                  'flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left text-[12.5px] outline-none transition-colors',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                  item.danger
                    ? 'text-danger data-[highlighted]:bg-danger-soft'
                    : 'text-foreground data-[highlighted]:bg-raised-hover',
                )}
              >
                {item.icon && <span className="shrink-0 text-faint" aria-hidden>{item.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <span className="tabular ml-auto pl-4 text-[10px] text-faint">{item.shortcut}</span>
                )}
              </DropdownMenuPrimitive.Item>
            ),
          )}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
