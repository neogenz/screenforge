import { cn } from '@/lib/utils'

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "inline-block aspect-[5900/1060] shrink-0 bg-current [mask-image:url('/brand/screenforge-wordmark.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
          className,
        )}
      />
      <span className="sr-only">ScreenForge</span>
    </>
  )
}
