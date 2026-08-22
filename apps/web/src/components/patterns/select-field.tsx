import type { ReactNode } from 'react'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface SelectOption<T extends string = string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

export interface SelectFieldProps<T extends string = string> {
  value: T
  onValueChange: (value: T) => void
  items: SelectOption<T>[]
  /**
   * Libellé posé dans le champ, à la manière d'`UnitField` : un contrôle d'une
   * ligne porte son libellé, seuls les composites en réclament un au-dessus.
   */
  label?: string
  'aria-label'?: string
  id?: string
  disabled?: boolean
  className?: string
}

/** Select coss à libellé en ligne, `items` déclarés plutôt que des `<option>`. */
export function SelectField<T extends string = string>({
  value,
  onValueChange,
  items,
  label,
  id,
  disabled,
  className,
  ...aria
}: SelectFieldProps<T>) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as T)
      }}
      items={items.map((item) => ({ value: item.value, label: item.label }))}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={aria['aria-label']}
        data-slot="select-field"
        className={cn('w-full', className)}
      >
        {label && <span className="shrink-0 text-xs text-muted-foreground">{label}</span>}
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  )
}
