import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, Ref } from 'react'
import { clampNumber, roundTo } from '@/lib/number'
import { cn } from '@/lib/utils'

export interface NumberFieldProps {
  /** Visible mini label, also used as the scrub handle (e.g. "X"). */
  label: string
  /** Full accessible name, e.g. "Position X". */
  ariaLabel: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  precision?: number
  disabled?: boolean
  className?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * Figma-grade numeric field: drag the label to scrub (⇧ = ×10, ⌥ = ×0.1),
 * or type directly. Commits live, Escape reverts.
 */
export function NumberField({
  label,
  ariaLabel,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 0,
  disabled = false,
  className,
  ref,
}: NumberFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const scrub = useRef<{ pointerId: number; startX: number; startValue: number } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function commit(next: number) {
    onChange(roundTo(clampNumber(next, min, max), precision))
  }

  function handleScrubDown(event: PointerEvent<HTMLSpanElement>) {
    if (disabled) return
    event.preventDefault()
    scrub.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleScrubMove(event: PointerEvent<HTMLSpanElement>) {
    const state = scrub.current
    if (!state || state.pointerId !== event.pointerId) return
    const modifier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1
    commit(state.startValue + (event.clientX - state.startX) * step * modifier)
  }

  function handleScrubUp(event: PointerEvent<HTMLSpanElement>) {
    const state = scrub.current
    if (!state || state.pointerId !== event.pointerId) return
    scrub.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    // Click without drag: focus the input instead.
    if (Math.abs(event.clientX - state.startX) < 2) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      setDraft(null)
      setEditing(false)
      event.currentTarget.blur()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      commit(value + (event.key === 'ArrowUp' ? step : -step) * (event.shiftKey ? 10 : 1))
    }
  }

  const display = editing && draft !== null ? draft : String(roundTo(value, precision))

  return (
    <div
      className={cn(
        'flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md border border-border bg-raised px-1.5',
        'transition-[border-color] duration-150 ease-out hover:border-border-strong',
        'focus-within:border-foreground-muted',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      <span
        role="presentation"
        aria-hidden
        onPointerDown={handleScrubDown}
        onPointerMove={handleScrubMove}
        onPointerUp={handleScrubUp}
        onPointerCancel={handleScrubUp}
        className="caps-label shrink-0 cursor-ew-resize touch-none select-none py-1"
        title={`${ariaLabel} — glisser pour ajuster`}
      >
        {label}
      </span>
      <input
        ref={(node) => {
          inputRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        value={display}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        onFocus={() => {
          setEditing(true)
          setDraft(String(roundTo(value, precision)))
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          const parsed = Number(event.target.value)
          if (event.target.value !== '' && Number.isFinite(parsed)) commit(parsed)
        }}
        onBlur={() => {
          setEditing(false)
          setDraft(null)
        }}
        onKeyDown={handleKeyDown}
        className="h-full w-full min-w-0 flex-1 bg-transparent font-mono text-[11px] tabular-nums text-foreground outline-none"
      />
    </div>
  )
}
