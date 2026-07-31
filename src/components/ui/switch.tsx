import { cn } from '@/lib/utils'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  disabled?: boolean
}

export function Switch({ checked, onChange, ariaLabel, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-4 w-7 shrink-0 items-center rounded-full border px-0.5 outline-none',
        'transition-[background,border-color] duration-150 ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked ? 'border-foreground bg-foreground' : 'border-border-strong bg-surface',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-2.5 w-2.5 rounded-full transition-transform duration-150 ease-out',
          checked ? 'translate-x-3 bg-panel' : 'translate-x-0 bg-muted',
        )}
      />
    </button>
  )
}
