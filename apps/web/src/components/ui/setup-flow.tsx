import { AlertCircle, Check } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SetupStepState = 'waiting' | 'active' | 'done' | 'error'

export function SetupFlow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="setup-flow"
      className={cn('surface-inner overflow-hidden', className)}
      {...props}
    />
  )
}

export function SetupStep({
  rank,
  title,
  state,
  result,
  children,
}: {
  rank: number
  title: string
  state: SetupStepState
  result?: ReactNode
  children?: ReactNode
}) {
  const current = state === 'active' || state === 'error'
  return (
    <div
      data-slot="setup-step"
      data-state={state}
      aria-current={state === 'active' ? 'step' : undefined}
      className={cn(
        'grid grid-cols-[1rem_minmax(0,1fr)] gap-2.5 transition-opacity duration-200 ease-out',
        state === 'waiting' && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-4 items-center justify-center rounded-sm border text-2xs tabular-nums',
          state === 'active' && 'marker-fill border-marker',
          state === 'done' && 'border-border bg-secondary text-foreground',
          state === 'error' && 'border-destructive bg-destructive text-destructive-foreground',
          state === 'waiting' && 'border-border bg-muted text-muted-foreground',
        )}
      >
        {state === 'done' ? (
          <Check size={10} strokeWidth={3} className="animate-check-in" />
        ) : state === 'error' ? (
          <AlertCircle size={10} strokeWidth={2.5} />
        ) : (
          rank
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-2xs font-semibold text-foreground">{title}</p>
        {state === 'active' && (
          <span role="status" aria-live="polite" className="sr-only">
            Étape active : {title}
          </span>
        )}
        {state === 'done'
          ? result && <div className="text-2xs text-muted-foreground">{result}</div>
          : current
            ? children
            : null}
      </div>
    </div>
  )
}

export function SetupProgress({
  label,
  value,
  max = 1,
}: {
  label: string
  value?: number
  max?: number
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <progress
        data-slot="setup-progress"
        aria-label={label}
        value={value}
        max={max}
        className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted accent-marker [&::-moz-progress-bar]:bg-marker [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-marker"
      />
      {value !== undefined && (
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
          {value} sur {max}
        </span>
      )}
    </div>
  )
}
