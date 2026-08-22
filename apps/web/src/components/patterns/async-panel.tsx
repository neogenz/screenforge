import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type AsyncState = 'idle' | 'pending' | 'ready' | 'failed'

export interface AsyncPanelProps {
  state: AsyncState
  /** Rendu à l'état `idle` : ce qu'on peut faire pour lancer. */
  idle?: ReactNode
  /** Squelette à la taille du résultat ; trois lignes `h-6` par défaut. */
  skeleton?: ReactNode
  /** Le résultat, à l'état `ready`. */
  children?: ReactNode
  failedTitle?: string
  failedMessage?: string
  /** L'action de reprise, nommée. */
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

/**
 * Un aperçu qui se calcule (release, campagne, locale) : le squelette a la
 * forme du résultat, le résultat arrive en `oa-arrive`, l'échec est une
 * `Alert` avec une reprise nommée. État piloté par le parent et non par
 * Suspense : ici les aperçus sont des promesses déjà lancées, pas des
 * ressources.
 */
export function AsyncPanel({
  state,
  idle,
  skeleton,
  children,
  failedTitle = 'L’aperçu n’a pas pu se calculer.',
  failedMessage,
  onRetry,
  retryLabel = 'Réessayer',
  className,
}: AsyncPanelProps) {
  return (
    <div data-slot="async-panel" data-state={state} className={cn('min-w-0', className)}>
      {state === 'idle' && idle}
      {state === 'pending' && (
        <div role="status" aria-label="Calcul en cours" className="flex flex-col gap-2">
          {skeleton ?? (
            <>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
            </>
          )}
        </div>
      )}
      {state === 'ready' && <div className="oa-arrive">{children}</div>}
      {state === 'failed' && (
        <Alert variant="error">
          <AlertTriangle aria-hidden />
          <AlertTitle>{failedTitle}</AlertTitle>
          {failedMessage && <AlertDescription>{failedMessage}</AlertDescription>}
          {onRetry && (
            <AlertAction>
              <Button size="sm" variant="outline" onClick={onRetry}>
                {retryLabel}
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}
    </div>
  )
}
