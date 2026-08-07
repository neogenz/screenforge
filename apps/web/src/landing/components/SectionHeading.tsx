import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/*
 * Le titre de section est un vrai `<h2>` posé sur le filet pleine largeur.
 * Il portait auparavant une cote « 01 » et un micro-label au-dessus : deux
 * lignes de décor pour zéro information, et surtout aucun élément de titrage
 * dans le document — la page rendait un `<h1>` et plus rien, la navigation par
 * titres ne retournait pas une section. Le filet garde la voix « plan ».
 *
 * Serif, graisse normale, bas de casse. Le titre était en Inter 800 capitales,
 * c'est-à-dire qu'il criait : à cette taille une graisse extrême épaissit les
 * contreformes jusqu'à ce que le mot devienne une masse, et les capitales lui
 * retirent en plus la ligne de crête (jambages et hampes) sur laquelle l'œil
 * reconnaît un mot sans l'épeler. Un display à contraste fort en 400 tient la
 * même surface noire avec des pleins et des déliés, donc une silhouette. La
 * hiérarchie ne vient plus du gras mais du corps et de la face — et le gras
 * redevient disponible pour ce qui doit vraiment ressortir dans un paragraphe.
 */
export function SectionHeading({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  return (
    <h2
      id={id}
      className={cn(
        'mx-auto max-w-5xl text-center font-display text-[clamp(2.7rem,5vw,4.5rem)] leading-[1.04] font-normal tracking-[-0.025em] text-balance',
        className,
      )}
    >
      {children}
    </h2>
  )
}
