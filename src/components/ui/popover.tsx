import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface PopoverProps {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  side?: 'bottom' | 'top'
  offset?: number
  className?: string
  role?: string
  ariaLabel?: string
}

/** Anchored floating panel: portal, viewport-clamped, closes on outside press / Escape. */
export function Popover({
  open,
  anchor,
  onClose,
  children,
  align = 'start',
  side = 'bottom',
  offset = 6,
  className,
  role,
  ariaLabel,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return

    function update() {
      const anchorEl = anchor.current
      const panel = panelRef.current
      if (!anchorEl || !panel) return
      const rect = anchorEl.getBoundingClientRect()
      const { width, height } = panel.getBoundingClientRect()
      const margin = 8
      let left = align === 'start' ? rect.left : rect.right - width
      let top = side === 'bottom' ? rect.bottom + offset : rect.top - height - offset
      left = Math.min(Math.max(margin, left), window.innerWidth - width - margin)
      top = Math.min(Math.max(margin, top), window.innerHeight - height - margin)
      setPosition({ left, top })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchor.current?.contains(target)) return
      onClose()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open, anchor, align, side, offset, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        visibility: position ? 'visible' : 'hidden',
      }}
      className={cn(
        'menu-shadow z-[90] animate-menu-in overflow-hidden rounded-xl border border-border bg-raised',
        side === 'bottom' ? 'origin-top' : 'origin-bottom',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}
