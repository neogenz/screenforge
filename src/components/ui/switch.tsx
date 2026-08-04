import { Switch as SwitchPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  disabled?: boolean
}

export function Switch({ checked, onChange, ariaLabel, disabled = false }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'inline-flex h-4 w-7 shrink-0 items-center rounded-full border px-0.5',
        'transition-[background,border-color] duration-150 ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-muted',
        'data-[state=checked]:border-foreground data-[state=checked]:bg-foreground',
        'hover:data-[state=checked]:border-foreground-muted hover:data-[state=checked]:bg-foreground-muted',
        'data-[state=unchecked]:border-border-strong data-[state=unchecked]:bg-inset',
        'hover:data-[state=unchecked]:bg-raised-hover',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <SwitchPrimitive.Thumb
        aria-hidden
        className={cn(
          'h-2.5 w-2.5 rounded-full transition-transform duration-150 ease-out',
          'data-[state=checked]:translate-x-3 data-[state=checked]:bg-stage',
          'data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-faint',
        )}
      />
    </SwitchPrimitive.Root>
  )
}
