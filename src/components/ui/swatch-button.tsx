import type { ButtonHTMLAttributes, Ref } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SwatchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Couleur affichée dans la pastille. Peut être translucide. */
  color: string
  selected?: boolean
  ref?: Ref<HTMLButtonElement>
}

/**
 * Pastille de couleur (couleurs d'appareil, nuanciers). Le damier alpha se voit
 * sous une couleur translucide, et le contour permanent garde une pastille
 * blanche visible sur panneau clair comme une noire sur panneau sombre.
 * L'anneau de sélection est neutre, jamais coloré.
 */
export function SwatchButton({
  color,
  selected = false,
  className,
  ref,
  ...props
}: SwatchButtonProps) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      aria-pressed={selected}
      className={cn(
        // L'anneau vit dans le padding : aucun décalage de mise en page à la sélection.
        'h-8 w-8 shrink-0 rounded-full p-[3px] ring-inset hover:bg-transparent',
        'transition-[box-shadow] duration-150 ease-out',
        selected
          ? 'ring-2 ring-foreground'
          : 'ring-1 ring-transparent hover:ring-border-strong',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="checkerboard block h-full w-full rounded-full">
        <span
          className="block h-full w-full rounded-full ring-1 ring-inset ring-border-strong"
          style={{ backgroundColor: color }}
        />
      </span>
    </Button>
  )
}
