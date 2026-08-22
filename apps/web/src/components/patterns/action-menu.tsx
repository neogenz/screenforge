import { useMemo } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from '@/components/ui/menu'
import { Kbd } from '@/components/ui/kbd'

export interface ActionMenuItem {
  id?: string
  label: string
  icon?: ReactNode
  /** Secondary info on the right (e.g. screen size), plain tabular text. */
  meta?: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

/** Une entrée de menu est soit une action, soit un filet. */
export type ActionMenuEntry = ActionMenuItem | 'separator'

function MenuEntries({ items }: { items: ActionMenuEntry[] }) {
  return items.map((item, index) =>
    item === 'separator' ? (
      <MenuSeparator key={`separator-${index}`} />
    ) : (
      <MenuItem
        key={item.id ?? item.label}
        disabled={item.disabled}
        variant={item.danger ? 'destructive' : 'default'}
        onClick={() => item.onSelect()}
      >
        {item.icon && (
          <span className="shrink-0 text-muted-foreground" aria-hidden>
            {item.icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.meta && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.meta}</span>
        )}
        {item.shortcut && (
          <MenuShortcut>
            <Kbd>{item.shortcut}</Kbd>
          </MenuShortcut>
        )}
      </MenuItem>
    ),
  )
}

export interface DropdownProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactElement
  items: ActionMenuEntry[]
  ariaLabel: string
  align?: 'start' | 'end'
  className?: string
}

/** Menu d'actions coss ancré sur un déclencheur, navigable au clavier. */
export function Dropdown({
  open,
  onOpenChange,
  trigger,
  items,
  ariaLabel,
  align = 'start',
  className,
}: DropdownProps) {
  return (
    <Menu open={open} onOpenChange={(next) => onOpenChange(next)} modal={false}>
      <MenuTrigger render={trigger} />
      <MenuPopup aria-label={ariaLabel} align={align} sideOffset={6} className={className}>
        <MenuEntries items={items} />
      </MenuPopup>
    </Menu>
  )
}

export interface ContextMenuProps {
  position: { left: number; top: number }
  label: string
  items: ActionMenuEntry[]
  onClose: () => void
  /** Élément qui reprend le focus à la fermeture — la ligne ou la vignette d'où le menu est parti. */
  returnFocus?: { current: HTMLElement | null }
}

/** Menu à position libre (clic droit sur le canvas), borné à la fenêtre par le positioner coss. */
export function ContextMenu({ position, label, items, onClose, returnFocus }: ContextMenuProps) {
  // Ancre virtuelle : un point, sans élément dans l'arbre qu'un ancêtre
  // transformé (filmstrip, drawers) pourrait piéger.
  const anchor = useMemo(
    () => ({ getBoundingClientRect: () => new DOMRect(position.left, position.top, 0, 0) }),
    [position.left, position.top],
  )

  return (
    <Menu
      open
      modal={false}
      onOpenChange={(isOpen) => {
        if (isOpen) return
        onClose()
        requestAnimationFrame(() => {
          if (returnFocus?.current?.isConnected) returnFocus.current.focus()
        })
      }}
    >
      <MenuPopup
        data-context-menu
        aria-label={label}
        anchor={anchor}
        align="start"
        side="bottom"
        sideOffset={0}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuEntries items={items} />
      </MenuPopup>
    </Menu>
  )
}
