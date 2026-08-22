import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Island } from '@/components/patterns/island'
import { cn } from '@/lib/utils'

export interface DrawerIslandProps {
  /** Identifiant du titre : le repère `aside` est nommé par lui. */
  titleId: string
  title: string
  /** À droite du titre : un compte, un filtre… */
  headerExtra?: ReactNode
  /** Sous la rangée de titre, encore dans l'en-tête (un champ de filtre). */
  headerBelow?: ReactNode
  onClose: () => void
  closeLabel: string
  children: ReactNode
  className?: string
}

/**
 * Le tiroir : un `Island` à bord perdu, un en-tête (h2, extra, fermer) et un
 * corps que chaque panneau fait défiler comme il l'entend — la liste des
 * calques est une `listbox`, et c'est elle qui porte son défilement.
 */
export function DrawerIsland({
  titleId,
  title,
  headerExtra,
  headerBelow,
  onClose,
  closeLabel,
  children,
  className,
}: DrawerIslandProps) {
  return (
    <Island
      flush
      render={<aside aria-labelledby={titleId} />}
      data-slot="drawer-island"
      className={cn('flex max-h-full min-h-0 flex-col overflow-hidden', className)}
    >
      <div className="shrink-0 px-3 pt-2 pb-2">
        <div className="flex h-8 items-center gap-2">
          <h2 id={titleId} className="text-base font-medium min-w-0 flex-1 truncate">
            {title}
          </h2>
          {headerExtra}
          <Button variant="ghost" size="icon-xs" aria-label={closeLabel} onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
        {headerBelow}
      </div>
      {children}
    </Island>
  )
}

/** Le corps défilant d'un tiroir, à fondu aux deux bouts. */
export function DrawerBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // Le tiroir n'a pas de hauteur fixe, seulement un plafond : le `h-full`
    // du viewport coss ne se résout pas. On le fait flex et on borne l'enfant.
    <ScrollArea
      scrollFade
      className={cn(
        'flex min-h-0 flex-col px-3 pb-3 *:data-[slot=scroll-area-viewport]:min-h-0 *:data-[slot=scroll-area-viewport]:flex-1',
        className,
      )}
    >
      {children}
    </ScrollArea>
  )
}
