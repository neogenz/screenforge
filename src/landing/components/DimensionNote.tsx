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
        <span className="h-px w-2 bg-border" />
        <span className="w-px flex-1 bg-border" />
        <span className="[writing-mode:vertical-rl]">{value}</span>
        <span className="w-px flex-1 bg-border" />
        <span className="h-px w-2 bg-border" />
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
      <span className="h-2 w-px bg-border" />
      <span className="h-px flex-1 bg-border" />
      <span>{value}</span>
      <span className="h-px flex-1 bg-border" />
      <span className="h-2 w-px bg-border" />
    </div>
  )
}
