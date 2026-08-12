import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover } from '@/components/ui/popover'
import { groupsOf, ICON_BOX, ICON_STROKE, SHAPE_BOX } from '@/lib/vector-catalog'
import { cn } from '@/lib/utils'

interface VectorEntry {
  id: string
  label: string
  group: string
  path?: string
}

export interface VectorPickerProps {
  entries: readonly VectorEntry[]
  value: string
  onChange: (id: string) => void
  /** `shape` remplit son tracé, `icon` le dessine au trait. */
  kind: 'shape' | 'icon'
  label: string
  searchPlaceholder: string
}

/**
 * Un seul sélecteur pour les formes et pour les icônes.
 *
 * Il lit le catalogue et rien d'autre : la vignette est le tracé même qui sera
 * rendu sur la planche, donc aucune image d'aperçu ne peut se désynchroniser
 * de la forme livrée. Quatorze formes ne tiennent pas dans un `Segmented` —
 * une grille groupée et filtrable est ce que le nombre impose.
 */
export function VectorPicker({
  entries,
  value,
  onChange,
  kind,
  label,
  searchPlaceholder,
}: VectorPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState(value)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const query = search.trim().toLowerCase()
  const filtered = query
    ? entries.filter(
        (entry) => entry.label.toLowerCase().includes(query) || entry.id.includes(query),
      )
    : entries
  const groups = groupsOf(filtered)
  const positioned: { id: string; row: number; column: number }[] = []
  let nextRow = 0
  for (const [, items] of groups) {
    items.forEach((entry, index) => {
      positioned.push({ id: entry.id, row: nextRow + Math.floor(index / 5), column: index % 5 })
    })
    nextRow += Math.ceil(items.length / 5)
  }
  const current = entries.find((entry) => entry.id === value)
  const active = filtered.find((entry) => entry.id === activeId) ?? filtered[0]

  // Reset the search when the panel closes (derived state, no effect).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) setSearch('')
  }

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  function close(returnFocus = false) {
    setOpen(false)
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function focusOption(id: string) {
    setActiveId(id)
    const options = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-vector-option]')
    Array.from(options ?? [])
      .find((option) => option.dataset.vectorOption === id)
      ?.focus()
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="default"
        size="sm"
        onClick={() => {
          setActiveId(value)
          setOpen((isOpen) => !isOpen)
        }}
        className="field-surface h-8 w-full justify-between border-border bg-muted font-normal normal-case hover:bg-muted"
        aria-label={`${label} : ${current?.label ?? value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="field-label shrink-0 select-none">{label}</span>
          <VectorGlyph entry={current} kind={kind} size={14} />
          <span className="truncate">{current?.label ?? value}</span>
        </span>
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Button>

      <Popover
        open={open}
        anchor={triggerRef}
        onClose={close}
        onEscape={() => close(true)}
        className="w-56"
      >
        <div className="border-b border-border p-1.5">
          <Input
            ref={searchRef}
            font="sans"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setActiveId('')
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' || !active) return
              event.preventDefault()
              focusOption(active.id)
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>

        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="max-h-72 overflow-y-auto p-1"
        >
          {groups.map(([group, items]) => (
            <div key={group}>
              <div role="presentation" className="field-label px-2 pt-1.5 pb-1">
                {group}
              </div>
              <div className="grid grid-cols-5 gap-1 px-1 pb-1">
                {items.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={entry.id === value}
                    aria-label={entry.label}
                    title={entry.label}
                    tabIndex={entry.id === active?.id ? 0 : -1}
                    data-vector-option={entry.id}
                    onFocus={() => setActiveId(entry.id)}
                    onKeyDown={(event) => {
                      if (
                        event.key !== 'ArrowLeft' &&
                        event.key !== 'ArrowRight' &&
                        event.key !== 'ArrowUp' &&
                        event.key !== 'ArrowDown'
                      ) {
                        return
                      }

                      event.preventDefault()
                      const currentPosition = positioned.find(
                        (position) => position.id === entry.id,
                      )
                      if (!currentPosition) return
                      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                      const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                      const targetRow = currentPosition.row + (backwards ? -1 : 1)
                      const targetColumn = currentPosition.column + (backwards ? -1 : 1)
                      const next = horizontal
                        ? positioned.find(
                            (position) =>
                              position.row === currentPosition.row &&
                              position.column === targetColumn,
                          )
                        : positioned
                            .filter((position) => position.row === targetRow)
                            .sort(
                              (a, b) =>
                                Math.abs(a.column - currentPosition.column) -
                                Math.abs(b.column - currentPosition.column),
                            )[0]
                      if (next) focusOption(next.id)
                    }}
                    onClick={() => {
                      onChange(entry.id)
                      close(true)
                    }}
                    className={cn(
                      'flex h-8 w-full items-center justify-center rounded-md border border-transparent',
                      'text-foreground transition-colors duration-120 hover:bg-accent',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      entry.id === value && 'border-border bg-accent',
                    )}
                  >
                    <VectorGlyph entry={entry} kind={kind} size={16} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="field-label px-2 py-3 text-center">Aucun résultat</div>
          )}
        </div>
      </Popover>
    </>
  )
}

/** La vignette est le tracé du catalogue, jamais une image à part. */
function VectorGlyph({
  entry,
  kind,
  size,
}: {
  entry: VectorEntry | undefined
  kind: 'shape' | 'icon'
  size: number
}) {
  if (!entry) return null
  const box = kind === 'icon' ? ICON_BOX : SHAPE_BOX
  const stroke =
    kind === 'icon' ? { fill: 'none', stroke: 'currentColor' } : { fill: 'currentColor' }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      strokeWidth={kind === 'icon' ? ICON_STROKE : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {entry.path ? (
        <path d={entry.path} {...stroke} />
      ) : entry.id === 'circle' ? (
        <circle cx={box / 2} cy={box / 2} r={box / 2} fill="currentColor" />
      ) : (
        <rect
          x={0}
          y={0}
          width={box}
          height={box}
          rx={entry.id === 'rounded-rect' ? box / 8 : 0}
          fill="currentColor"
        />
      )}
    </svg>
  )
}
