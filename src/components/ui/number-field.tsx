import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, Ref } from 'react'
import { clampNumber, roundTo } from '@/lib/number'
import { cn } from '@/lib/utils'

/** Distance en pixels avant qu'un appui devienne un scrub plutôt qu'un clic. */
const SCRUB_THRESHOLD = 3

export interface NumberFieldProps {
  /**
   * Préfixe court affiché dans le champ, ex. « X ». Casse normale, en retrait :
   * c'est la grammaire des champs numériques, distincte du libellé au-dessus
   * que porte `Field` pour tous les autres contrôles.
   */
  label?: string
  /** Nom accessible complet, ex. « Position X ». */
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
 * Champ numérique scrubbable sur toute sa surface : glisser ajuste
 * (⇧ = ×10, ⌥ = ×0.1), cliquer focalise et laisse saisir. Commit live, Échap annule.
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
  const [scrubbing, setScrubbing] = useState(false)
  const scrub = useRef<{
    pointerId: number
    startX: number
    startValue: number
    engaged: boolean
  } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function commit(next: number) {
    onChange(roundTo(clampNumber(next, min, max), precision))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return
    // Pas de preventDefault : sous le seuil, l'appui reste un clic qui focalise.
    scrub.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: value,
      engaged: false,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = scrub.current
    if (!state || state.pointerId !== event.pointerId) return
    const delta = event.clientX - state.startX
    if (!state.engaged) {
      if (Math.abs(delta) < SCRUB_THRESHOLD) return
      state.engaged = true
      setScrubbing(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      // Le caret suivrait le pointeur et sélectionnerait le texte pendant le drag.
      inputRef.current?.blur()
    }
    const modifier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1
    commit(state.startValue + delta * step * modifier)
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const state = scrub.current
    if (!state || state.pointerId !== event.pointerId) return
    scrub.current = null
    if (state.engaged) {
      event.currentTarget.releasePointerCapture(event.pointerId)
      setScrubbing(false)
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title={`${ariaLabel} — glisser pour ajuster`}
      className={cn(
        // `flex-1` sert à partager la largeur quand deux champs se suivent en
        // ligne ; posé seul dans une colonne, il laisse l'algorithme flex fixer
        // la hauteur et écrase le champ à 19px. `min-h-8` reprend la main.
        'flex h-8 min-h-8 min-w-0 flex-1 cursor-ew-resize touch-none items-center gap-1.5 px-2.5',
        'rounded-md border border-input bg-muted shadow-(--shadow-inset)',
        'transition-[border-color] duration-150 ease-out hover:border-input',
        // L'anneau de focus vit sur le champ entier, pas sur l'input qu'il contient.
        'focus-within:border-ring focus-within:outline-[1.5px]',
        'focus-within:outline-offset-2 focus-within:outline-ring',
        scrubbing && 'select-none border-ring',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      {label && (
        <span aria-hidden className="field-label shrink-0 select-none text-muted-foreground">
          {label}
        </span>
      )}
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
        onFocus={(event) => {
          setEditing(true)
          setDraft(String(roundTo(value, precision)))
          event.currentTarget.select()
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
        className={cn(
          'h-full w-full min-w-0 flex-1 bg-transparent text-sm tabular-nums text-foreground outline-none',
          // Le curseur texte n'apparaît qu'une fois le champ en édition.
          editing ? 'cursor-text' : 'cursor-ew-resize',
        )}
      />
    </div>
  )
}
