import { cn } from '@/lib/utils'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EASE_OUT_EXPO, REVEAL_DURATION_MS } from '../motion'

/*
 * Reveal au scroll, une seule fois par section. Sous prefers-reduced-motion
 * le contenu est rendu visible d'emblée : le mouvement part, le contenu reste.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Sous prefers-reduced-motion le contenu est visible dès le premier rendu :
  // le mouvement part, le contenu reste.
  const [shown, setShown] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return (
    <div
      ref={ref}
      style={{
        transitionDuration: `${REVEAL_DURATION_MS}ms`,
        transitionTimingFunction: EASE_OUT_EXPO,
        transitionDelay: shown ? `${delay}ms` : '0ms',
      }}
      className={cn(
        'transition-[opacity,transform] motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
