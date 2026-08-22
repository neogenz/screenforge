import { useEffect, useRef, useState } from 'react'
import { POPULAR_FONTS, isFontLoaded, loadGoogleFont } from '@/lib/fonts'
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from '@/components/ui/combobox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface FontPickerProps {
  value: string
  onChange: (family: string) => void
  id?: string
  /** Libellé posé dans le champ : même grammaire que `UnitField` et `SelectField`. */
  label?: string
}

/** Liste filtrable des polices : `Combobox` coss, la recherche est le champ lui-même. */
export function FontPicker({ value, onChange, id, label }: FontPickerProps) {
  return (
    <Combobox
      items={POPULAR_FONTS}
      value={value}
      onValueChange={(next) => {
        if (typeof next === 'string' && next) onChange(next)
      }}
    >
      <div data-slot="font-picker" className="flex w-full items-center gap-1.5">
        {label && (
          <span className="shrink-0 select-none text-xs text-muted-foreground">{label}</span>
        )}
        <ComboboxInput
          id={id}
          aria-label={`Police : ${value}`}
          placeholder="Rechercher une police…"
          className="min-w-0 flex-1"
        />
      </div>
      <ComboboxPopup aria-label="Polices">
        <ComboboxEmpty>Aucune police trouvée</ComboboxEmpty>
        <ComboboxList>
          {(family: string) => (
            <FontOption key={family} family={family} selected={family === value} />
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  )
}

function FontOption({ family, selected }: { family: string; selected: boolean }) {
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
    <ComboboxItem
      ref={itemRef}
      value={family}
      className={cn(selected && 'bg-secondary text-foreground')}
    >
      {fontLoaded ? (
        // Rendu dans sa propre police pour de bon : un aperçu en police de
        // repli ne prévisualise rien, il ment sur ce que la police rendra.
        // `oa-arrive` se joue une fois, à la création de ce `<span>` — il
        // n'existe pas tant que le squelette ci-dessous est affiché.
        <span className="oa-arrive truncate" style={{ fontFamily: `"${family}", system-ui` }}>
          {family}
        </span>
      ) : (
        <Skeleton className="h-3.5 w-24" />
      )}
    </ComboboxItem>
  )
}
