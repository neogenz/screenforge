import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export interface PanelSectionProps {
  title: string
  defaultOpen?: boolean
  /** À droite du titre, hors du bouton : un Switch, un compte. */
  headerExtra?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * Une bande, pas une carte : un filet `border-t` et le rythme font le
 * groupe, une carte creusée mettrait l'îlot, la carte et le champ sur trois
 * niveaux. Le `h3` porte le bouton `aria-expanded` (accordéon APG) : il se
 * parcourt à la tabulation et se trouve au saut de titre.
 */
export function PanelSection({
  title,
  defaultOpen = true,
  headerExtra,
  children,
  className,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('border-t border-border pt-2 first:border-t-0 first:pt-0', className)}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium min-w-0 flex-1">
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                className="flex h-8 w-full items-center justify-start gap-1.5 rounded-none px-0 font-[inherit] text-[inherit] hover:bg-transparent hover:text-foreground"
              />
            }
          >
            <ChevronRight
              size={12}
              strokeWidth={1.75}
              aria-hidden
              className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-150 ease-out',
                open && 'rotate-90',
              )}
            />
            <span>{title}</span>
          </CollapsibleTrigger>
        </h3>
        {headerExtra}
      </div>
      {children && (
        <CollapsiblePanel>
          {/* Sans `minmax(0,…)` un enfant à texte insécable élargit la piste au-delà du tiroir. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 pb-1 *:min-w-0">{children}</div>
        </CollapsiblePanel>
      )}
    </Collapsible>
  )
}
