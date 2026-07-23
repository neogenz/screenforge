import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { POPULAR_FONTS, isFontLoaded, loadGoogleFont } from '@/hooks/use-fonts'
import { cn } from '@/lib/utils'

interface FontPickerProps {
  value: string
  onChange: (family: string) => void
}

const PINNED_COUNT = 10

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [fontError, setFontError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const filteredFonts = search.trim()
    ? POPULAR_FONTS.filter((font) => font.toLowerCase().includes(search.toLowerCase()))
    : POPULAR_FONTS

  useEffect(() => {
    let cancelled = false
    void loadGoogleFont(value).then((result) => {
      if (cancelled) return
      setFontError(result.status === 'fallback'
        ? `${value} indisponible. Police système de secours affichée.`
        : null)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  async function handleSelect(family: string) {
    const result = await loadGoogleFont(family)
    setFontError(result.status === 'fallback'
      ? `${family} indisponible. Police système de secours affichée.`
      : null)
    onChange(family)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-panel px-2 text-[12px] text-foreground',
          'transition-colors duration-100 ease-out hover:border-border-strong',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground-muted',
        )}
        style={{ fontFamily: `"${value}", system-ui` }}
        aria-label={`Police : ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={12} strokeWidth={1.5} className="shrink-0 text-foreground-muted" />
      </button>

      {fontError && (
        <p className="mt-1.5 text-[11px] leading-snug text-warning" role="status">
          {fontError}
        </p>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-panel animate-[fade-in_0.12s_ease-out]">
          <div className="border-b border-border p-1.5">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une police…"
              aria-label="Rechercher une police"
              className="input h-8 text-[11px]"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <ul role="listbox" aria-label="Polices" className="max-h-60 overflow-y-auto">
            {filteredFonts.map((family, index) => (
              <FontOption
                key={family}
                family={family}
                selected={family === value}
                isPinned={!search.trim() && index < PINNED_COUNT}
                onSelect={handleSelect}
              />
            ))}
            {filteredFonts.length === 0 && (
              <li className="mono-label px-3 py-3">Aucune police trouvée</li>
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
  const itemRef = useRef<HTMLLIElement>(null)
  const [fontLoaded, setFontLoaded] = useState(isFontLoaded(family))

  useEffect(() => {
    if (fontLoaded || !itemRef.current) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return
      observer.disconnect()
      void loadGoogleFont(family, ['400']).then((result) => {
        setFontLoaded(result.status === 'loaded')
      })
    }, { threshold: 0.1 })
    observer.observe(itemRef.current)
    return () => observer.disconnect()
  }, [family, fontLoaded])

  return (
    <li ref={itemRef} role="none">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => void onSelect(family)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 px-2 text-left text-[12px]',
          'transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground-muted',
          selected
            ? 'bg-surface-active text-foreground'
            : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground',
        )}
        style={fontLoaded ? { fontFamily: `"${family}", system-ui` } : undefined}
      >
        <span className="truncate">{family}</span>
        <span className="flex shrink-0 items-center gap-2">
          {isPinned && <span className="mono-label">Populaire</span>}
          {selected && <Check size={11} strokeWidth={2} className="text-foreground" />}
        </span>
      </button>
    </li>
  )
}
