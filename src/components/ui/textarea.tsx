import type { Ref, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>
}

/** Multi-ligne, même grammaire que Input : en creux, redimensionnable en hauteur seulement. */
export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        'field-surface w-full resize-y px-2 py-1.5',
        'text-[12.5px] leading-snug text-foreground placeholder:text-faint',
        'transition-[border-color] duration-150 ease-out',
        'hover:border-border-strong focus:border-foreground-muted',
        'aria-invalid:border-danger aria-invalid:hover:border-danger aria-invalid:focus:border-danger',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}
