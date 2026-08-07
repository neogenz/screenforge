import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/*
 * Micro-label technique — la voix blueprint de la page. Réservé aux mentions
 * de spécification (nom d'offre, légende de tableau), jamais au corps de texte
 * et jamais au-dessus d'un titre : un sur-titre ne fait que voler du poids au
 * titre qu'il annonce.
 *
 * L'interlettrage tombe de 0,14 à 0,08em en passant à la mono. Les deux
 * réglages font le même travail — donner de l'air à une capitale — et la
 * chasse fixe en fournit déjà la moitié. Cumulés, `SPÉCIFICATION D'EXPORT`
 * s'étalait au point que les mots cessaient d'être des mots.
 */
export function SpecLabel({
  id,
  children,
  className,
}: {
  id?: string
  children: ReactNode
  className?: string
}) {
  return (
    <p
      id={id}
      className={cn(
        'font-mono text-2xs tracking-[0.08em] text-muted-foreground uppercase',
        className,
      )}
    >
      {children}
    </p>
  )
}
