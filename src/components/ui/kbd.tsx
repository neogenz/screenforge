import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-surface px-1',
        'font-mono text-[9px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
