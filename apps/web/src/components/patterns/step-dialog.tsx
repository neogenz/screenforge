import { useState, type CSSProperties, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { DialogShell, type DialogShellProps } from '@/components/patterns/dialog-shell'
import { cn } from '@/lib/utils'

export interface DialogStep {
  id: string
  title: string
  content: ReactNode
}

export interface StepDialogProps extends Omit<
  DialogShellProps,
  'children' | 'footer' | 'back' | 'headerActions'
> {
  steps: DialogStep[]
  /** Index de l'étape courante, piloté par le parent. */
  step: number
  onStep: (index: number) => void
  /** L'action primaire de l'étape courante (un Button default, quantifié). */
  action: ReactNode
  backDisabled?: boolean
  /** Le retour nommé par ce qu'il quitte (« Retour au brief ») ; « Retour » sinon. */
  backLabel?: string
  /** Le contenu porte déjà son propre titre : ne pas en répéter un. */
  showStepTitle?: boolean
  /** Hauteur plancher du panneau, pour qu'un aller-retour ne fasse pas sauter le pied. */
  minHeight?: number
}

/**
 * Un parcours en étapes : Progress coss dans l'en-tête (« 2/3 », chaque
 * étape `aria-current="step"`), le contenu glisse de 12px dans le sens de la
 * navigation, le pied garde « Retour » et l'action primaire de l'étape.
 */
// ponytail: `minHeight` déclaré par l'appelant, pas mesuré par ResizeObserver ;
// une mesure si une boîte saute visiblement.
export function StepDialog({
  steps,
  step,
  onStep,
  action,
  backDisabled,
  backLabel = 'Retour',
  showStepTitle = true,
  minHeight,
  title,
  description,
  ...shell
}: StepDialogProps) {
  const [prev, setPrev] = useState(step)
  const [direction, setDirection] = useState<1 | -1>(1)
  if (step !== prev) {
    setDirection(step > prev ? 1 : -1)
    setPrev(step)
  }
  const current = steps[step]
  const progress = (
    <div className="flex items-center gap-2" aria-label={`Étape ${step + 1} sur ${steps.length}`}>
      <ol className="flex items-center gap-1" aria-label="Étapes">
        {steps.map((s, index) => (
          <li
            key={s.id}
            aria-current={index === step ? 'step' : undefined}
            title={s.title}
            className={cn(
              'size-1.5 rounded-full transition-ui',
              index <= step ? 'bg-foreground' : 'bg-muted-foreground/40',
            )}
          >
            <span className="sr-only">{s.title}</span>
          </li>
        ))}
      </ol>
      <span className="text-xs text-muted-foreground tabular-nums">
        {step + 1}/{steps.length}
      </span>
    </div>
  )

  return (
    <DialogShell
      {...shell}
      title={title}
      description={description}
      headerActions={progress}
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            disabled={backDisabled || step === 0}
            onClick={() => onStep(step - 1)}
          >
            {backLabel}
          </Button>
          {action}
        </>
      }
    >
      {/* Hors de `description` : un `<p>` ne peut pas contenir la piste. */}
      <Progress value={step + 1} max={steps.length} aria-label="Avancement" className="mb-3">
        <ProgressTrack>
          <ProgressIndicator className="transition-[width] duration-(--duration-base) ease-(--ease-out)" />
        </ProgressTrack>
      </Progress>
      <div
        key={current.id}
        data-step={current.id}
        className="animate-step"
        style={{ '--step-from': `${12 * direction}px`, minHeight } as CSSProperties}
      >
        {showStepTitle && <h3 className="section-title mb-2">{current.title}</h3>}
        {current.content}
      </div>
    </DialogShell>
  )
}
