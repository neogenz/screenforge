import { Button, type ButtonProps } from '@/components/ui/button'
import { Hint } from '@/components/patterns/hint'
import { cn } from '@/lib/utils'

export interface SwatchButtonProps extends Omit<ButtonProps, 'size' | 'variant'> {
  /** Couleur affichée dans la pastille. Peut être translucide. */
  color: string
  selected?: boolean
  /** Infobulle au survol et au focus — remplace le `title=` natif. */
  tooltip?: string
}

/**
 * Pastille de couleur (couleurs d'appareil, nuanciers). Le damier alpha se voit
 * sous une couleur translucide ; l'anneau de sélection est neutre, jamais coloré.
 */
export function SwatchButton({
  color,
  selected = false,
  className,
  tooltip,
  ...props
}: SwatchButtonProps) {
  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      data-slot="swatch-button"
      aria-pressed={selected}
      className={cn(
        // L'anneau vit dans le padding : aucun décalage de mise en page à la sélection.
        'shrink-0 rounded-full p-[3px] ring-inset hover:bg-transparent',
        selected ? 'ring-2 ring-foreground' : 'ring-1 ring-transparent hover:ring-input',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="checkerboard block size-full rounded-full">
        <span
          className="block size-full rounded-full ring-1 ring-inset ring-input"
          style={{ backgroundColor: color }}
        />
      </span>
    </Button>
  )
  return tooltip ? <Hint content={tooltip}>{button}</Hint> : button
}
