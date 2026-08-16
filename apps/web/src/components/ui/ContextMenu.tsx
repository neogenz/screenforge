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
  /** Élément qui reprend le focus à la fermeture — la ligne ou la vignette
      d'où le menu est parti. Sans lui le focus tombait au début du document. */
  returnFocus?: { current: HTMLElement | null }
}

/** Free-position menu (canvas right-click), clamped to the viewport by the Radix popper. */
export function ContextMenu({ position, label, items, onClose, returnFocus }: ContextMenuProps) {
  function handleClose() {
    onClose()
    requestAnimationFrame(() => {
      if (returnFocus?.current?.isConnected) returnFocus.current.focus()
    })
  }

  return (
    <DropdownMenuPrimitive.Root
      open
      modal={false}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
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
          onClick={(event) => event.stopPropagation()}
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
            'menu-shadow z-(--z-popover) min-w-[180px] animate-menu-in origin-top overflow-hidden rounded-lg border border-border bg-popover p-1',
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
                  'flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left text-sm outline-none transition-colors',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                  item.danger
                    ? 'text-destructive data-[highlighted]:bg-destructive/14'
                    : 'text-foreground data-[highlighted]:bg-accent',
                )}
              >
                {item.icon && (
                  <span className="shrink-0 text-muted-foreground" aria-hidden>
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <span className="tabular ml-auto pl-4 text-2xs text-muted-foreground">
                    {item.shortcut}
                  </span>
                )}
              </DropdownMenuPrimitive.Item>
            ),
          )}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
