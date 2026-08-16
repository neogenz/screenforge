import { AlertCircle, Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type SetupStepState = 'waiting' | 'active' | 'done' | 'error'

const setupStepVariants = cva(
  'grid grid-cols-[1rem_minmax(0,1fr)] gap-2.5 transition-opacity duration-200 ease-out',
  {
    variants: { state: { waiting: 'opacity-50', active: '', done: '', error: '' } },
  },
)

const setupMarkerVariants = cva(
  'mt-0.5 flex size-4 items-center justify-center rounded-sm border text-2xs tabular-nums',
  {
    variants: {
      state: {
        waiting: 'border-border bg-muted text-muted-foreground',
        active: 'marker-fill border-marker',
        done: 'border-border bg-secondary text-foreground',
        error: 'border-destructive bg-destructive text-destructive-foreground',
      },
    },
  },
)

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
  announce = true,
  children,
}: {
  rank: number
  title: string
  state: SetupStepState
  result?: ReactNode
  announce?: boolean
  children?: ReactNode
}) {
  const current = state === 'active' || state === 'error'
  return (
    <div
      data-slot="setup-step"
      data-state={state}
      aria-current={state === 'active' ? 'step' : undefined}
      className={setupStepVariants({ state })}
    >
      <span aria-hidden className={setupMarkerVariants({ state })}>
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
        {announce && state === 'active' && (
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

export function SetupCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-sm bg-muted px-2 py-1 text-2xs text-foreground">
        {command}
      </code>
      <Button
        variant="ghost"
        size="sm"
        className="self-start sm:self-auto"
        aria-label={`Copier « ${command} »`}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(command)
            .then(() => setCopied(true))
            .catch(() => undefined)
        }}
      >
        {copied ? (
          <Check size={12} className="animate-check-in" aria-hidden />
        ) : (
          <Copy size={12} aria-hidden />
        )}
        {copied ? 'Copié' : 'Copier'}
      </Button>
    </div>
  )
}
