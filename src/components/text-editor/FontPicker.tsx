import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { POPULAR_FONTS, loadGoogleFont, isFontLoaded } from '@/hooks/use-fonts'
import { cn } from '@/lib/utils'

interface FontPickerProps {
  value: string
  onChange: (family: string) => void
}

const PINNED_COUNT = 10

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = search.trim()
    ? POPULAR_FONTS.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : POPULAR_FONTS

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    setTimeout(() => searchRef.current?.focus(), 0)
    return () => setSearch('')
  }, [open])

  async function handleSelect(family: string) {
    await loadGoogleFont(family)
    onChange(family)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-7 w-full items-center justify-between gap-2 rounded-md border border-border bg-panel px-2 text-[12px] text-foreground',
          'transition-colors duration-100 ease-out',
          'hover:border-border-strong',
          'focus:outline-none focus:border-foreground-muted',
        )}
        style={{ fontFamily: `"${value}", system-ui` }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={12} strokeWidth={1.5} className="shrink-0 text-foreground-muted" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border bg-panel overflow-hidden animate-[fade-in_0.12s_ease-out]">
          <div className="border-b border-border p-1.5">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fonts…"
              className="input h-7 text-[11px]"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <ul
            role="listbox"
            className="overflow-y-auto max-h-60"
          >
            {filtered.map((family, i) => (
              <FontOption
                key={family}
                family={family}
                selected={family === value}
                isPinned={!search.trim() && i < PINNED_COUNT}
                onSelect={handleSelect}
              />
            ))}
            {filtered.length === 0 && (
              <li className="mono-label px-3 py-3">No fonts found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

interface FontOptionProps {
  family: string
  selected: boolean
  isPinned: boolean
  onSelect: (family: string) => void
}

function FontOption({ family, selected, isPinned, onSelect }: FontOptionProps) {
  const ref = useRef<HTMLLIElement>(null)
  const [fontLoaded, setFontLoaded] = useState(isFontLoaded(family))

  useEffect(() => {
    if (fontLoaded) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect()
          await loadGoogleFont(family, ['400'])
          setFontLoaded(true)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [family, fontLoaded])

  return (
    <li
      ref={ref}
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(family)}
      className={cn(
        'flex h-7 cursor-pointer items-center justify-between gap-2 px-2 text-[12px]',
        'transition-colors duration-100 ease-out',
        selected
          ? 'bg-surface-active text-foreground'
          : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground',
      )}
      style={fontLoaded ? { fontFamily: `"${family}", system-ui` } : undefined}
    >
      <span className="truncate">{family}</span>
      <span className="flex items-center gap-2 shrink-0">
        {isPinned && <span className="mono-label">Popular</span>}
        {selected && <Check size={11} strokeWidth={2} className="text-foreground" />}
      </span>
    </li>
  )
}
