import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/*
 * Deux actions, une seule silhouette : même hauteur, même filet d'un pixel,
 * même mono capitale. Elles ne se distinguent que par le remplissage, et
 * c'est la hiérarchie entière — la primaire est pleine, la secondaire est
 * vide. Un bouton qui change de forme selon son rang oblige à relire la
 * rangée pour trouver l'action ; un bouton qui change de valeur se lit d'un
 * coup d'œil.
 *
 * La mono, ici, n'est pas un tic de style : c'est la face qui porte les
 * relevés de la page, et un libellé d'action posé dans la même bouche que la
 * spécification dit que le bouton exécute ce que la fiche décrit. En
 * capitales et sans interlettrage ajouté — la chasse fixe fournit déjà la
 * largeur, et lui superposer un `tracking` disperse un libellé de deux mots.
 *
 * Le focus ring est explicitement `outline-ring` : sans couleur nommée,
 * `outline` prend `currentColor` — soit l'encre sombre du CTA citron,
 * invisible sur une page sombre. C'était le seul contrôle de la page dont
 * l'anneau de focus ne se voyait pas.
 *
 * L'action secondaire redevient un contour, ce qu'un aplat `secondary` avait
 * remplacé. L'objection tenait au filet `--color-input`, à 1,75:1 sur le fond
 * — sous les 3:1 que WCAG 1.4.11 demande à la limite d'un contrôle. Elle ne
 * tient plus : le trait est en `foreground`, soit la même encre que le texte
 * de la page, très au-dessus du seuil.
 */
const base =
  'inline-flex items-center justify-center border font-mono font-semibold uppercase transition-[color,background-color,border-color,scale] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function CtaPrimary({
  href,
  size = 'md',
  className,
  children,
}: {
  href: string
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={cn(
        base,
        'border-marker bg-marker text-marker-ink hover:border-marker-hover hover:bg-marker-hover',
        size === 'sm' ? 'h-9 px-3.5 text-2xs' : 'h-11 px-5 text-[13px]',
        className,
      )}
    >
      {children}
    </a>
  )
}

export function CtaGhost({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={cn(
        base,
        'h-11 border-foreground px-5 text-[13px] text-foreground hover:bg-foreground hover:text-background',
        className,
      )}
    >
      {children}
    </a>
  )
}
