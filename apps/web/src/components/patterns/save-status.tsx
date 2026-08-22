import { Check, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { StatusChip, StatusDot, type StatusTone } from '@/components/patterns/status-chip'
import { Spinner } from '@/components/ui/spinner'
import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'
import type { SaveStatus as SaveStatusValue } from '@/stores/ui.store'

const LABEL: Record<SaveStatusValue, string> = {
  idle: copy.save.idle,
  saving: copy.save.saving,
  saved: copy.save.saved,
  error: copy.save.error,
}

const TONE: Record<SaveStatusValue, StatusTone> = {
  idle: 'neutral',
  saving: 'pulse',
  saved: 'success',
  error: 'warning',
}

const MARK: Record<SaveStatusValue, ReactNode> = {
  idle: null,
  // `role="presentation"` : la puce porte déjà `role="status"`, un spinner qui
  // garde le sien compterait pour un second témoin dans la barre — mesuré par
  // `responsive-chrome.spec.ts`, qui recense `[role="status"]` un par un.
  saving: <Spinner role="presentation" aria-hidden className="size-3" />,
  saved: <Check size={11} className="text-success" aria-hidden />,
  error: <TriangleAlert size={11} aria-hidden />,
}

/**
 * L'état de sauvegarde locale : un point ou une icône, jamais un texte nu.
 *
 * La marque rejoue `animate-mark` à chaque changement d'état — `key={status}`
 * force React à la remonter, la puce elle-même ne bougeant jamais dans l'arbre.
 * `written` replie le libellé en `sr-only` sous l'étroit ; la région live
 * l'annonce dans tous les cas.
 */
export function SaveStatusChip({
  status,
  written,
  className,
}: {
  status: SaveStatusValue
  written: boolean
  className?: string
}) {
  return (
    <StatusChip
      role="status"
      aria-live="polite"
      title={written ? undefined : LABEL[status]}
      tone={TONE[status]}
      icon={
        <span key={status} className="animate-mark inline-flex shrink-0">
          {MARK[status] ?? <StatusDot tone={TONE[status]} />}
        </span>
      }
      className={cn(
        'h-auto min-w-0 shrink-0 border-transparent bg-transparent px-0 text-2xs',
        status === 'error' && 'text-destructive',
        className,
      )}
    >
      <span className={written ? '' : 'sr-only'}>{LABEL[status]}</span>
    </StatusChip>
  )
}
