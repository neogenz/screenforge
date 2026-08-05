import { cn } from '@/lib/utils'

/*
 * Cote de dimension façon plan : un filet terminé par deux embêts, la valeur
 * tabulaire au milieu. Décorative — l'information existe déjà dans le texte.
 */
export function DimensionNote({
  value,
  orientation = 'horizontal',
  className,
}: {
  value: string
  orientation?: 'horizontal' | 'vertical'
  className?: string
}) {
  if (orientation === 'vertical') {
    return (
      <div
        aria-hidden
        className={cn(
          'flex flex-col items-center gap-3 text-2xs tabular-nums text-muted-foreground',
          className,
        )}
      >
        <span className="h-px w-2 bg-marker-line" />
        <span className="w-px flex-1 bg-marker-line" />
        <span className="[writing-mode:vertical-rl]">{value}</span>
        <span className="w-px flex-1 bg-marker-line" />
        <span className="h-px w-2 bg-marker-line" />
      </div>
    )
  }
  return (
    <div
      aria-hidden
      className={cn(
        'flex items-center gap-3 text-2xs tabular-nums text-muted-foreground',
        className,
      )}
    >
      <span className="h-2 w-px bg-marker-line" />
      <span className="h-px flex-1 bg-marker-line" />
      <span>{value}</span>
      <span className="h-px flex-1 bg-marker-line" />
      <span className="h-2 w-px bg-marker-line" />
    </div>
  )
}
