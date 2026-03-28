import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
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

  // Close on outside click
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

  // Focus search when opening; reset on close via cleanup
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
          'flex h-7 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 text-xs text-foreground',
          'transition-[box-shadow,border-color,background-color] hover:border-muted hover:bg-surface-hover',
          'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20',
        )}
        style={{ fontFamily: `"${value}", system-ui` }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-md shadow-lg flex flex-col overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fonts..."
              className={cn(
                'w-full h-7 px-2 text-xs rounded-md border border-border',
                'bg-background text-foreground focus:outline-none focus:border-primary',
              )}
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
              <li className="px-3 py-2 text-xs text-muted">No fonts found</li>
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

  // Load font preview when scrolled into view
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
        'px-2 py-1.5 text-xs cursor-pointer flex items-center justify-between gap-2',
        'hover:bg-surface-hover transition-colors',
        selected && 'bg-primary/10 text-primary',
      )}
      style={fontLoaded ? { fontFamily: `"${family}", system-ui` } : undefined}
    >
      <span className="truncate">{family}</span>
      {isPinned && (
        <span className="text-xs text-muted shrink-0">popular</span>
      )}
    </li>
  )
}
