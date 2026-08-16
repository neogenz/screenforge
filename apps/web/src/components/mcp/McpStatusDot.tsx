import { cn } from '@/lib/utils'
import type { McpStatus } from '@/stores/mcp.store'

/**
 * L'état de la liaison, en un point de six pixels.
 *
 * Jamais le citron : celui-ci dit « vous êtes ici » — l'écran courant, le
 * calque sélectionné — et ne se pose sur aucune action. Un agent branché n'est
 * pas un endroit où l'on travaille, c'est une porte ouverte, et la chromie du
 * chrome reste neutre par principe dans un outil dont le métier est de juger
 * des couleurs.
 *
 * Trois valeurs et pas quatre : « en connexion » emprunte la grise de l'arrêt
 * en la faisant respirer, parce qu'un troisième gris entre `muted-foreground`
 * et `foreground` n'aurait été lisible sur aucun des deux thèmes.
 */
const FILL: Record<McpStatus, string> = {
  off: 'bg-muted-foreground/50',
  connecting: 'bg-muted-foreground animate-pulse motion-reduce:animate-none',
  live: 'bg-foreground',
  error: 'bg-destructive',
}

export function McpStatusDot({ status, className }: { status: McpStatus; className?: string }) {
  return (
    <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', FILL[status], className)} />
  )
}
