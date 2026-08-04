import type { ComponentProps } from 'react'
import { Label as LabelPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50', className)}
      {...props}
    />
  )
}
