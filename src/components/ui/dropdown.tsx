import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'
import { Popover } from '@/components/ui/popover'

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
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset the active item when the menu opens (derived state, no effect).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setActiveIndex(Math.max(0, items.findIndex((item) => !item.disabled)))
  }

  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.focus()
  }, [open, activeIndex])

  function handleKeyDown(event: React.KeyboardEvent) {
    const enabledIndexes = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled)
      .map(({ index }) => index)
    if (enabledIndexes.length === 0) return
    const currentEnabled = enabledIndexes.indexOf(activeIndex)

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const next = enabledIndexes[
        (currentEnabled + delta + enabledIndexes.length) % enabledIndexes.length
      ]
      setActiveIndex(next)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(enabledIndexes[0])
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(enabledIndexes[enabledIndexes.length - 1])
    }
  }

  return (
    <Popover open={open} anchor={anchor} onClose={onClose} align={align} role="menu" ariaLabel={ariaLabel} className={className}>
      <div ref={listRef} onKeyDown={handleKeyDown} className="min-w-44 p-1">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            data-index={index}
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
            onMouseEnter={() => !item.disabled && setActiveIndex(index)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none',
              'transition-colors duration-100 ease-out',
              'disabled:pointer-events-none disabled:opacity-40',
              index === activeIndex && (item.danger ? 'bg-danger-soft' : 'bg-surface-hover'),
              item.danger ? 'text-danger' : 'text-foreground',
            )}
          >
            {item.icon && <span className="shrink-0 text-faint" aria-hidden>{item.icon}</span>}
            <span className="min-w-0 flex-1 truncate text-[12px]">{item.label}</span>
            {item.meta && (
              <span className="mono-value shrink-0 text-[10px] text-faint">{item.meta}</span>
            )}
            {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
          </button>
        ))}
      </div>
    </Popover>
  )
}
