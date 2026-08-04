import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border bg-muted px-1',
        'tabular text-[10px] font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
