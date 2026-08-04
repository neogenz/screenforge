import type { ReactElement, ReactNode } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
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
  onOpenChange: (open: boolean) => void
  trigger: ReactElement
  items: MenuItem[]
  ariaLabel: string
  align?: 'start' | 'end'
  className?: string
}

/** Keyboard-navigable action menu anchored to a trigger. */
export function Dropdown({ open, onOpenChange, trigger, items, ariaLabel, align = 'start', className }: DropdownProps) {
  return (
    <DropdownMenuPrimitive.Root
      open={open}
      modal={false}
      onOpenChange={onOpenChange}
    >
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          aria-label={ariaLabel}
          aria-labelledby={undefined}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          loop
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className={cn(
            'menu-shadow z-(--z-popover) min-w-44 animate-menu-in origin-top overflow-hidden rounded-lg border border-border bg-popover p-1',
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
                  ? 'text-destructive data-[highlighted]:bg-destructive/14'
                  : 'text-foreground data-[highlighted]:bg-accent',
              )}
            >
              {item.icon && <span className="shrink-0 text-muted-foreground" aria-hidden>{item.icon}</span>}
              <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
              {item.meta && (
                <span className="tabular shrink-0 text-2xs text-muted-foreground">{item.meta}</span>
              )}
              {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
