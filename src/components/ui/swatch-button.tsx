import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

export interface SwatchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Fill color shown inside the swatch. */
  color: string
  selected?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** Round color swatch (device colors…). Active state is neutral, never red. */
export function SwatchButton({ color, selected = false, className, type = 'button', ref, ...props }: SwatchButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        'h-7 w-7 rounded-full border-2 transition-[border-color,transform] duration-100 ease-out',
        selected
          ? 'scale-105 border-foreground'
          : 'border-transparent hover:border-border-strong',
        className,
      )}
      style={{ backgroundColor: color }}
      {...props}
    />
  )
}
