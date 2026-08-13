import { useEffect, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { Check, ChevronDown } from 'lucide-react'
import { POPULAR_FONTS, isFontLoaded, loadGoogleFont } from '@/lib/fonts'
import { Button } from '@/components/ui/button'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface FontPickerProps {
  value: string
  onChange: (family: string) => void
  id?: string
  /** Libellé posé dans le champ : même grammaire que `NumberField` et `Select`. */
  label?: string
}

/** Head of POPULAR_FONTS pinned under "Populaires" when not searching. */
const PINNED_COUNT = 10

export function FontPicker({ value, onChange, id, label }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const searching = search.trim() !== ''
  const pinned = searching ? [] : POPULAR_FONTS.slice(0, PINNED_COUNT)
  const rest = searching ? POPULAR_FONTS : POPULAR_FONTS.slice(PINNED_COUNT)

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

  function close(returnFocus = false) {
    setOpen(false)
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function handleSelect(family: string) {
    onChange(family)
    close(true)
  }

  return (
    <>
      <Button
        ref={triggerRef}
        id={id}
        variant="default"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        className="field-surface h-8 w-full justify-between border-border bg-muted font-normal normal-case hover:bg-muted"
        aria-label={`Police : ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {label && <span className="field-label shrink-0 select-none">{label}</span>}
          <span className="truncate">{value}</span>
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
        <Command loop>
          <div className="border-b border-border p-1.5">
            <Command.Input
              ref={searchRef}
              value={search}
              onValueChange={setSearch}
              placeholder="Rechercher une police…"
              aria-label="Rechercher une police"
              className="field-surface h-8 w-full px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground"
            />
          </div>

          <Command.List label="Polices" className="max-h-60 overflow-y-auto p-1">
            <Command.Empty className="field-label px-2 py-3 text-center">
              Aucune police trouvée
            </Command.Empty>
            {pinned.length > 0 && (
              <Command.Group heading="Populaires">
                {pinned.map((family) => (
                  <FontOption
                    key={family}
                    family={family}
                    selected={family === value}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>
            )}
            {pinned.length > 0 && <Command.Separator className="hairline mx-1 my-1" />}
            {rest.map((family) => (
              <FontOption
                key={family}
                family={family}
                selected={family === value}
                onSelect={handleSelect}
              />
            ))}
          </Command.List>
        </Command>
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
  const itemRef = useRef<HTMLDivElement>(null)
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
    <Command.Item
      ref={itemRef}
      value={family}
      onSelect={() => onSelect(family)}
      className={cn(
        'flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm',
        'cursor-default transition-colors duration-100 ease-out',
        'data-[selected=true]:bg-accent data-[selected=true]:text-foreground',
        selected
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      style={fontLoaded ? { fontFamily: `"${family}", system-ui` } : undefined}
    >
      <span className="truncate">{family}</span>
      {selected && (
        <Check size={11} strokeWidth={2} className="shrink-0 text-foreground" aria-hidden />
      )}
    </Command.Item>
  )
}
