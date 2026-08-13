import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FieldProps {
  /** Associates the visible label with the control via htmlFor. */
  id?: string
  label: string
  children: ReactNode
  className?: string
  /** Render label + control on one row instead of stacked. */
  inline?: boolean
}

export function Field({ id, label, children, className, inline = false }: FieldProps) {
  return (
    <div
      className={cn(
        inline ? 'flex items-center justify-between gap-2' : 'flex flex-col gap-1.5',
        className,
      )}
    >
      {/* Sans `id`, un <label> sans `for` est un élément orphelin : il n'associe
          rien et un validateur le relève. Le span garde la même typographie. */}
      {id ? (
        <Label htmlFor={id} className="field-label shrink-0">
          {label}
        </Label>
      ) : (
        <span className="field-label shrink-0">{label}</span>
      )}
      {children}
    </div>
  )
}
