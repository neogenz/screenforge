import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface TooltipProps {
  label: string
  children: ReactElement
  side?: 'top' | 'bottom'
  delay?: number
}

/** Hover/focus tooltip. Wraps the trigger in an inline-flex span. */
export function Tooltip({ label, children, side = 'top', delay = 350 }: TooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  function show() {
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition({
        left: rect.left + rect.width / 2,
        top: side === 'top' ? rect.top - 6 : rect.bottom + 6,
      })
      setVisible(true)
    }, delay)
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  return (
    <>
      <span
        ref={wrapperRef}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onPointerDown={hide}
      >
        {children}
      </span>
      {visible && position && createPortal(
        <div
          role="tooltip"
          style={{ left: position.left, top: position.top }}
          className={cn(
            'menu-shadow pointer-events-none fixed z-[100] -translate-x-1/2 animate-fade-in',
            'whitespace-nowrap rounded-md border border-border bg-raised px-1.5 py-1',
            'font-mono text-[10px] text-foreground-muted',
            side === 'top' ? '-translate-y-full' : 'translate-y-0',
          )}
        >
          {label}
        </div>,
        document.body,
      )}
    </>
  )
}
