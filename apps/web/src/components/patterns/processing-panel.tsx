import type { ReactNode } from 'react'
import { AlertCircle, Check, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export type ProcessingStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error'

export interface ProcessingStep {
  key: string
  label: string
  status: ProcessingStatus
  note?: string
  error?: string
}

export interface ProcessingPanelProps {
  title: string
  steps: ProcessingStep[]
  /** Reprise nommée de l'étape en échec. */
  onRetry?: () => void
  retryLabel?: string
  retryPending?: boolean
  footer?: ReactNode
  className?: string
}

/**
 * Une tâche longue montrée par ses vraies étapes (export, rafraîchissement,
 * publication). La barre compte les étapes finies, jamais un pourcentage
 * simulé ; elle garde sa couleur en échec, l'icône et la phrase portent
 * l'état. Porté de mandat-tan, sans les liens de correction.
 */
export function ProcessingPanel({
  title,
  steps,
  onRetry,
  retryLabel = 'Reprendre cette étape',
  retryPending,
  footer,
  className,
}: ProcessingPanelProps) {
  const finished = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length
  const failed = steps.some((s) => s.status === 'error')
  const running = !failed && steps.some((s) => s.status === 'running' || s.status === 'pending')
  const verdict = failed
    ? 'Une étape a échoué : corrigez ce qu’elle indique, puis reprenez'
    : running
      ? 'En cours'
      : 'Terminé'

  return (
    <section
      aria-live="polite"
      data-slot="processing-panel"
      className={cn('animate-enter flex flex-col gap-3 rounded-lg border bg-card p-3', className)}
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="section-title">{title}</h3>
        <p className="text-xs text-muted-foreground">
          {verdict} · {finished}/{steps.length} étapes
        </p>
      </div>

      <Progress value={finished} max={steps.length} aria-label="Étapes terminées">
        <ProgressTrack>
          <ProgressIndicator className="transition-[width] duration-(--duration-slow) ease-(--ease-out)" />
        </ProgressTrack>
      </Progress>

      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2" data-status={step.status}>
            {/* Clé sur l'état : un changement remonte la marque et rejoue son entrée. */}
            <StepMark key={step.status} status={step.status} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  'text-sm',
                  step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
              {step.status === 'error' && step.error ? (
                <span className="text-xs text-destructive">{step.error}</span>
              ) : step.note ? (
                <span className="text-xs text-muted-foreground">{step.note}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {(failed && onRetry) || footer ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          {failed && onRetry && (
            <Button size="sm" onClick={onRetry} loading={retryPending}>
              {retryLabel}
            </Button>
          )}
          {footer}
        </div>
      ) : null}
    </section>
  )
}

function StepMark({ status }: { status: ProcessingStatus }) {
  const base = 'animate-mark mt-0.5 grid size-5 shrink-0 place-items-center rounded-full'
  if (status === 'done')
    return (
      <span className={cn(base, 'bg-success/12 text-success')}>
        <Check aria-hidden className="size-3" />
      </span>
    )
  if (status === 'skipped')
    return (
      <span className={cn(base, 'bg-muted text-muted-foreground')}>
        <Minus aria-hidden className="size-3" />
      </span>
    )
  if (status === 'error')
    return (
      <span className={cn(base, 'bg-destructive/10 text-destructive')}>
        <AlertCircle aria-hidden className="size-3.5" />
      </span>
    )
  if (status === 'running')
    return (
      <span className={cn(base, 'text-foreground')}>
        <Spinner aria-label="En cours" className="size-4" />
      </span>
    )
  return <span className={cn(base, 'border border-dashed border-input')} aria-hidden />
}
