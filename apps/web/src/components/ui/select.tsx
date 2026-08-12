import { Check, ChevronDown } from 'lucide-react'
import type { ChangeEvent, ReactNode, Ref } from 'react'
import { Children, isValidElement } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { cn } from '@/lib/utils'

const EMPTY_OPTION_VALUE = '__screenforge_empty_option__'

function toRadixValue(value: string | number) {
  return String(value) || EMPTY_OPTION_VALUE
}

export interface SelectProps {
  value?: string | number
  defaultValue?: string | number
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
  /**
   * Libellé posé dans le champ, à la manière de `NumberField`. C'est la
   * grammaire de champ du panneau : un contrôle d'une ligne porte son libellé,
   * seuls les contrôles multi-lignes ou composites en réclament un au-dessus.
   */
  label?: string
  className?: string
  disabled?: boolean
  id?: string
  name?: string
  'aria-label'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  children?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

interface ParsedOption {
  value: string
  content: ReactNode
  text: string
  disabled?: boolean
}

function parseOptions(children: ReactNode): ParsedOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return []
    const props = child.props as {
      value?: string | number
      children?: ReactNode
      disabled?: boolean
    }
    if (props.value === undefined) return []
    return [
      {
        value: String(props.value),
        content: props.children,
        text:
          typeof props.children === 'string'
            ? props.children
            : String(props.children ?? props.value),
        disabled: props.disabled,
      },
    ]
  })
}

/** Select Radix habillé comme un Input, API compatible avec l'ancien select natif. */
export function Select({
  value,
  defaultValue,
  onChange,
  label,
  className,
  disabled,
  id,
  name,
  children,
  ref,
  ...ariaProps
}: SelectProps) {
  const options = parseOptions(children)
  const handleValueChange = (next: string) => {
    onChange?.({
      target: { value: next === EMPTY_OPTION_VALUE ? '' : next },
    } as ChangeEvent<HTMLSelectElement>)
  }
  return (
    <SelectPrimitive.Root
      value={value !== undefined ? toRadixValue(value) : undefined}
      defaultValue={defaultValue !== undefined ? toRadixValue(defaultValue) : undefined}
      onValueChange={handleValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectPrimitive.Trigger
        ref={ref}
        id={id}
        aria-label={ariaProps['aria-label']}
        aria-invalid={ariaProps['aria-invalid']}
        className={cn(
          'field-surface relative flex h-8 w-full items-center gap-2 pl-2.5 pr-7 text-left outline-none',
          'text-sm text-foreground',
          'transition-[border-color] duration-150 ease-out',
          'hover:border-input focus:border-muted-foreground',
          'aria-invalid:border-destructive aria-invalid:hover:border-destructive aria-invalid:focus:border-destructive',
          'disabled:pointer-events-none disabled:opacity-40',
          className,
        )}
      >
        {label && (
          <span aria-hidden className="field-label shrink-0 select-none">
            {label}
          </span>
        )}
        <SelectPrimitive.Value className="min-w-0 flex-1 truncate" />
        <SelectPrimitive.Icon className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          <ChevronDown size={11} strokeWidth={1.5} aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'menu-shadow z-(--z-popover) max-h-72 min-w-(--radix-select-trigger-width) overflow-y-auto',
            'rounded-md border border-border bg-popover text-foreground',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={toRadixValue(option.value)}
                textValue={option.text}
                disabled={option.disabled}
                className={cn(
                  'relative flex h-8 cursor-pointer items-center rounded-sm pr-7 pl-2 outline-none select-none',
                  'text-sm',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                  'data-[highlighted]:bg-accent',
                )}
              >
                <SelectPrimitive.ItemText>{option.content}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                  <Check size={12} strokeWidth={1.5} aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
