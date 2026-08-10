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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const query = search.trim().toLowerCase()
  const filtered = query
    ? entries.filter(
        (entry) => entry.label.toLowerCase().includes(query) || entry.id.includes(query),
      )
    : entries
  const groups = groupsOf(filtered)
  const current = entries.find((entry) => entry.id === value)

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

  return (
    <>
      <Button
        ref={triggerRef}
        variant="default"
        size="sm"
        onClick={() => setOpen((isOpen) => !isOpen)}
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

      <Popover open={open} anchor={triggerRef} onClose={() => setOpen(false)} className="w-56">
        <div className="border-b border-border p-1.5">
          <Input
            ref={searchRef}
            font="sans"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>

        <div role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1">
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
                    onClick={() => {
                      onChange(entry.id)
                      setOpen(false)
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
