import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

export interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  /** Secondary info on the right (e.g. screen size), plain mono text. */
  meta?: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

export interface DropdownProps {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  items: MenuItem[]
  ariaLabel: string
  align?: 'start' | 'end'
  className?: string
}

/** Keyboard-navigable action menu anchored to a trigger. */
export function Dropdown({ open, anchor, onClose, items, ariaLabel, align = 'start', className }: DropdownProps) {
  // DropdownMenu n'a pas d'Anchor virtuel : un Trigger invisible, calé sur la
  // ref externe, sert de point d'ancrage au popper.
  const rect = open ? anchor.current?.getBoundingClientRect() : undefined

  function handleOutside(event: { target: unknown; preventDefault: () => void }) {
    if (anchor.current?.contains(event.target as Node)) event.preventDefault()
  }

  return (
    <DropdownMenuPrimitive.Root
      open={open}
      modal={false}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      {createPortal(
        <DropdownMenuPrimitive.Trigger asChild>
          <span
            className="pointer-events-none fixed"
            style={{
              left: rect?.left ?? 0,
              top: rect?.top ?? 0,
              width: rect?.width ?? 0,
              height: rect?.height ?? 0,
            }}
          />
        </DropdownMenuPrimitive.Trigger>,
        document.body,
      )}
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          aria-label={ariaLabel}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          loop
          onCloseAutoFocus={(event) => {
            // Pas de Trigger Radix : le focus revient manuellement au déclencheur.
            event.preventDefault()
            anchor.current?.focus()
          }}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onPointerDownOutside={handleOutside}
          onInteractOutside={handleOutside}
          className={cn(
            'menu-shadow z-(--z-popover) min-w-44 animate-menu-in origin-top overflow-hidden rounded-lg border border-border bg-panel p-1',
            className,
          )}
        >
          {items.map((item) => (
            <DropdownMenuPrimitive.Item
              key={item.id}
              disabled={item.disabled}
              onSelect={() => item.onSelect()}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left outline-none',
                'transition-colors duration-100 ease-out',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                item.danger
                  ? 'text-danger data-[highlighted]:bg-danger-soft'
                  : 'text-foreground data-[highlighted]:bg-raised-hover',
              )}
            >
              {item.icon && <span className="shrink-0 text-faint" aria-hidden>{item.icon}</span>}
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.label}</span>
              {item.meta && (
                <span className="tabular shrink-0 text-[10px] text-faint">{item.meta}</span>
              )}
              {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
