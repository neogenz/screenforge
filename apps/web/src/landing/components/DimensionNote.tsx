import { cn } from '@/lib/utils'

/*
 * Cote de dimension, au sens du dessin technique.
 *
 * La version précédente était un filet citron terminé par deux ergots d'un
 * pixel, avec la valeur flottant dans une trouée de douze : de loin, une ligne
 * cassée. Trois choses la trahissaient.
 *
 * Elle est restée citron, et c'est délibéré : la passer en gris de bordure lui
 * a fait perdre tout caractère — sur un fond presque noir, un filet
 * `--color-border` de un pixel ne se voit plus, et la page a perdu la seule
 * annotation qui disait « relevé ». La règle « le marqueur est un état » vaut
 * pour les contrôles ; une cote n'est pas sur la planche, elle est à côté, et
 * elle est le repère de mesure de la page. Le partage est donc : la valeur et
 * les terminaisons portent le citron plein, le long filet reste sur
 * `--color-marker-line`, qui est déjà le citron dilué.
 *
 * Il lui manquait ses lignes d'attache. Une cote ne flotte pas à côté de
 * l'objet : deux traits perpendiculaires montent de l'objet mesuré jusqu'à la
 * ligne de cote, et c'est ce qui dit ce qui est mesuré. Sans elles, le filet ne
 * mesurait rien de particulier.
 *
 * Ses extrémités étaient des ergots. Le dessin d'architecture termine une cote
 * par un tiret à 45°, jamais par un T : c'est le seul détail qui distingue un
 * relevé d'une ligne posée là. Il est ici obtenu par rotation d'un trait d'un
 * pixel, donc net à toute densité.
 *
 * Décorative (`aria-hidden`) : la valeur est écrite en clair quatre fois
 * ailleurs sur la page.
 */
const LINE = 'bg-marker-line'

function Tick({ vertical }: { vertical?: boolean }) {
  return (
    <span className={cn('shrink-0 rotate-45 bg-marker', vertical ? 'h-px w-2.5' : 'h-2.5 w-px')} />
  )
}

export function DimensionNote({
  value,
  orientation = 'horizontal',
  className,
}: {
  value: string
  orientation?: 'horizontal' | 'vertical'
  className?: string
}) {
  const label = (
    <span className="shrink-0 font-mono text-2xs tracking-[0.06em] text-marker">{value}</span>
  )

  if (orientation === 'vertical') {
    return (
      <div aria-hidden className={cn('relative flex flex-col items-center gap-2', className)}>
        {/* Lignes d'attache : elles partent de l'objet et rejoignent la cote. */}
        <span className={cn('absolute top-0 -left-2.5 h-px w-2.5', LINE)} />
        <span className={cn('absolute bottom-0 -left-2.5 h-px w-2.5', LINE)} />
        <Tick vertical />
        <span className={cn('w-px flex-1', LINE)} />
        <span className="[writing-mode:vertical-rl]">{label}</span>
        <span className={cn('w-px flex-1', LINE)} />
        <Tick vertical />
      </div>
    )
  }

  return (
    <div aria-hidden className={cn('relative flex items-center gap-2', className)}>
      <span className={cn('absolute -top-2.5 left-0 h-2.5 w-px', LINE)} />
      <span className={cn('absolute -top-2.5 right-0 h-2.5 w-px', LINE)} />
      <Tick />
      <span className={cn('h-px flex-1', LINE)} />
      {label}
      <span className={cn('h-px flex-1', LINE)} />
      <Tick />
    </div>
  )
}
