import type { ReactNode } from 'react'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'

export interface PropertyRowProps {
  label: string
  /** Multi-ligne (Slider, Textarea) : le libellé s'empile au-dessus. */
  stacked?: boolean
  /** Une aide courte sous le contrôle. Jamais une erreur : les champs clampent. */
  description?: string
  children: ReactNode
  className?: string
}

/**
 * Une ligne libellé / contrôle du panneau, `Field` coss. Base UI câble
 * `aria-labelledby` du libellé sur le contrôle : le nom accessible est donc
 * le libellé visible, et un `aria-label` posé sur le contrôle ne gagne plus.
 * Un contrôle qui doit garder son nom long passe `nativeInput` ou sort du
 * `Field`.
 */
export function PropertyRow({
  label,
  stacked,
  description,
  children,
  className,
}: PropertyRowProps) {
  return (
    <Field
      data-slot="property-row"
      className={cn(
        stacked ? 'gap-1.5' : 'grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2',
        className,
      )}
    >
      <FieldLabel className="text-xs text-muted-foreground">{label}</FieldLabel>
      {stacked ? children : <div className="flex min-w-0 items-center gap-2">{children}</div>}
      {description && (
        <FieldDescription className={cn(!stacked && 'col-start-2')}>{description}</FieldDescription>
      )}
    </Field>
  )
}
