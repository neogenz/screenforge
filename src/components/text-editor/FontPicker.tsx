import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { POPULAR_FONTS, isFontLoaded, loadGoogleFont } from '@/hooks/use-fonts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface FontPickerProps {
  value: string
  onChange: (family: string) => void
  id?: string
}

/** Head of POPULAR_FONTS pinned under "Populaires" when not searching. */
const PINNED_COUNT = 10

export function FontPicker({ value, onChange, id }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const query = search.trim().toLowerCase()
  const filtered = query
    ? POPULAR_FONTS.filter((family) => family.toLowerCase().includes(query))
    : POPULAR_FONTS
  const pinned = query ? [] : filtered.slice(0, PINNED_COUNT)
  const rest = query ? filtered : filtered.slice(PINNED_COUNT)

  // Reset the search when the panel closes (derived state, no effect).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) setSearch('')
  }

  // Focus the search field once the panel is positioned and visible.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  function handleSelect(family: string) {
    onChange(family)
    setOpen(false)
  }

  return (
    <>
      <Button
        ref={triggerRef}
        id={id}
        variant="default"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        className="h-7 w-full justify-between font-normal normal-case"
        aria-label={`Police : ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={11} strokeWidth={1.5} className="shrink-0 text-faint" aria-hidden />
      </Button>

      <Popover open={open} anchor={triggerRef} onClose={() => setOpen(false)} className="w-56">
        <div className="border-b border-border p-1.5">
          <Input
            ref={searchRef}
            font="sans"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une police…"
            aria-label="Rechercher une police"
          />
        </div>

        <div role="listbox" aria-label="Polices" className="max-h-60 overflow-y-auto p-1">
          {pinned.length > 0 && (
            <>
              <div role="presentation" className="caps-label px-2 pb-1 pt-1.5">
                Populaires
              </div>
              {pinned.map((family) => (
                <FontOption
                  key={family}
                  family={family}
                  selected={family === value}
                  onSelect={handleSelect}
                />
              ))}
              <div role="presentation" className="hairline mx-1 my-1" />
            </>
          )}
          {rest.map((family) => (
            <FontOption
              key={family}
              family={family}
              selected={family === value}
              onSelect={handleSelect}
            />
          ))}
          {filtered.length === 0 && (
            <div className="caps-label px-2 py-3 text-center">Aucune police trouvée</div>
          )}
        </div>
      </Popover>
    </>
  )
}

interface FontOptionProps {
  family: string
  selected: boolean
  onSelect: (family: string) => void
}

function FontOption({ family, selected, onSelect }: FontOptionProps) {
  const itemRef = useRef<HTMLButtonElement>(null)
  const [fontLoaded, setFontLoaded] = useState(() => isFontLoaded(family))

  // Load the preview font only when the row scrolls into view.
  useEffect(() => {
    if (fontLoaded || !itemRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        observer.disconnect()
        void loadGoogleFont(family, ['400']).then((result) => {
          setFontLoaded(result.status === 'loaded')
        })
      },
      { threshold: 0.1 },
    )
    observer.observe(itemRef.current)
    return () => observer.disconnect()
  }, [family, fontLoaded])

  return (
    <button
      ref={itemRef}
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(family)}
      className={cn(
        'flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[12px] outline-none',
        'transition-colors duration-100 ease-out',
        'focus-visible:bg-surface-hover',
        selected
          ? 'bg-surface-active text-foreground'
          : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground',
      )}
      style={fontLoaded ? { fontFamily: `"${family}", system-ui` } : undefined}
    >
      <span className="truncate">{family}</span>
      {selected && <Check size={11} strokeWidth={2} className="shrink-0 text-foreground" aria-hidden />}
    </button>
  )
}
