import { ChevronDown } from 'lucide-react'
import type { Ref, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>
  /**
   * Libellé posé dans le champ, à la manière de `NumberField`. C'est la
   * grammaire de champ du panneau : un contrôle d'une ligne porte son libellé,
   * seuls les contrôles multi-lignes ou composites en réclament un au-dessus.
   */
  label?: string
}

/** Select natif habillé comme un Input, chevron en currentColor (aucun hex en CSS). */
export function Select({ className, children, label, ref, ...props }: SelectProps) {
  return (
    <div className="relative w-full">
      {label && (
        <span
          aria-hidden
          className="field-label pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 select-none"
        >
          {label}
        </span>
      )}
      <select
        ref={ref}
        style={label ? { paddingLeft: `calc(${label.length}ch * 0.56 + 1.25rem)` } : undefined}
        className={cn(
          'field-surface h-8 w-full appearance-none pl-2.5 pr-7',
          'text-[12.5px] text-foreground',
          'transition-[border-color] duration-150 ease-out',
          'hover:border-border-strong focus:border-foreground-muted',
          'aria-invalid:border-danger aria-invalid:hover:border-danger aria-invalid:focus:border-danger',
          'disabled:pointer-events-none disabled:opacity-40',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={11}
        strokeWidth={1.5}
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  )
}
