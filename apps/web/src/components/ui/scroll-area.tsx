import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ScrollAreaProps {
  children: ReactNode
  /** Classes du conteneur défilant : plafond, retrait, rôle ARIA. */
  className?: string
  /** Classes de la piste intérieure : c'est elle qui porte le rythme vertical. */
  contentClassName?: string
  role?: string
  'aria-label'?: string
  'aria-multiselectable'?: boolean
}

/**
 * Zone défilante qui signale le contenu resté sous le pli.
 *
 * Le drawer coupait net son dernier contrôle en deux, sans rien indiquer. Le
 * dégradé n'apparaît que tant qu'il reste à faire défiler, et disparaît une
 * fois le bas atteint.
 */
export function ScrollArea({ children, className, contentClassName, ...aria }: ScrollAreaProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [below, setBelow] = useState(false)

  const measure = useCallback(() => {
    const el = viewport.current
    // Un pixel de marge : les hauteurs fractionnaires laissent un résidu qui
    // ferait clignoter le dégradé une fois le bas atteint.
    if (el) setBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
  }, [])

  useEffect(() => {
    const track = content.current
    if (!track) return
    measure()
    // Une section qui se replie ne re-rend pas cette zone : c'est la hauteur de
    // la piste qu'il faut observer, pas le cycle de rendu React.
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [measure])

  return (
    <div
      ref={viewport}
      onScroll={measure}
      data-fade={below || undefined}
      className={cn('scroll-fade min-h-0 overflow-y-auto', className)}
      {...aria}
    >
      <div ref={content} className={contentClassName}>
        {children}
      </div>
    </div>
  )
}
