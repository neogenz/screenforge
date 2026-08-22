import { Button, type ButtonProps } from '@/components/ui/button'
import { Hint } from '@/components/patterns/hint'
import { cn } from '@/lib/utils'

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'variant'> {
  /** Every icon-only button must be labelled. */
  'aria-label': string
  size?: 'sm' | 'md'
  /**
   * « Ce panneau est ouvert » — neutre, jamais le citron, qui est réservé à
   * ce que l'utilisateur édite.
   */
  active?: boolean
  /** Infobulle au survol et au focus — remplace le `title=` natif. */
  tooltip?: string
}

/** Bouton icône : `Button` coss ghost, taille icône, état ouvert + infobulle. */
export function IconButton({ size = 'md', active, tooltip, className, ...props }: IconButtonProps) {
  const button = (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon-sm' : 'icon'}
      data-slot="icon-button"
      data-active={active || undefined}
      className={cn(
        'text-muted-foreground hover:text-foreground',
        'data-[active=true]:border-input data-[active=true]:bg-secondary data-[active=true]:text-foreground',
        className,
      )}
      {...props}
    />
  )
  return tooltip ? <Hint content={tooltip}>{button}</Hint> : button
}
