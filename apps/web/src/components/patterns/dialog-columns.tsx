import type { ReactNode } from 'react'
import { belowWidth, useMediaQuery } from '@/hooks/use-media-query'
import { DIALOG_SIDEBAR_WIDTH, DIALOG_STACK_MIN_WIDTH } from '@/lib/stage'
import { cn } from '@/lib/utils'

export interface DialogColumnsProps {
  /** Nom accessible de la colonne étroite. */
  railLabel: string
  /** Nom accessible de la colonne principale, quand elle en mérite un. */
  contentLabel?: string
  /** La colonne étroite : une liste à choisir, ou un récapitulatif à lire. */
  rail: ReactNode
  /**
   * `start` : le rail porte ce qu'on choisit (maître-détail). `end` : il
   * récapitule ce que la colonne principale décide. L'ordre du DOM suit
   * l'ordre visuel dans les deux configurations.
   */
  railSide?: 'start' | 'end'
  children: ReactNode
}

/**
 * Deux colonnes dans un `DialogPanel` à fleur de bord. Sous
 * `DIALOG_STACK_MIN_WIDTH` elles s'empilent et c'est la boîte qui défile, pas
 * chaque colonne. Le seuil se lit par `useMediaQuery`, jamais en dur.
 */
export function DialogColumns({
  railLabel,
  contentLabel,
  rail,
  railSide = 'start',
  children,
}: DialogColumnsProps) {
  const stacked = useMediaQuery(belowWidth(DIALOG_STACK_MIN_WIDTH))
  const first = railSide === 'start'

  const railColumn = (
    <aside
      key="rail"
      aria-label={railLabel}
      className={cn(
        'flex flex-col gap-3 border-border px-4 py-4',
        stacked
          ? first
            ? 'border-b'
            : 'border-t'
          : cn('max-h-[56dvh] overflow-y-auto', first ? 'border-r' : 'border-l'),
      )}
    >
      {rail}
    </aside>
  )
  const contentColumn = (
    <section
      key="content"
      aria-label={contentLabel}
      className={cn('flex flex-col gap-4 px-6 py-4', !stacked && 'max-h-[56dvh] overflow-y-auto')}
    >
      {children}
    </section>
  )

  const track = `minmax(0,${DIALOG_SIDEBAR_WIDTH}px)`
  return (
    <div
      data-slot="dialog-columns"
      data-dialog-columns
      className="grid"
      style={{
        gridTemplateColumns: stacked
          ? 'minmax(0,1fr)'
          : first
            ? `${track} minmax(0,1fr)`
            : `minmax(0,1fr) ${track}`,
      }}
    >
      {first ? [railColumn, contentColumn] : [contentColumn, railColumn]}
    </div>
  )
}
