import type { Ref, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>
}

/** Multi-line field sharing the Input look. */
export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border bg-surface px-2 py-2 outline-none',
        'font-sans text-[12px] leading-snug text-foreground placeholder:text-faint',
        'transition-[border-color,background] duration-150 ease-out',
        'hover:border-border-strong focus:border-foreground-muted',
        className,
      )}
      {...props}
    />
  )
}
