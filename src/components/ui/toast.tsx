import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { useToastStore, type ToastTone } from '@/stores/toast.store'
import { cn } from '@/lib/utils'

const TONE_ICON: Record<ToastTone, React.ReactNode> = {
  info: <Info size={13} strokeWidth={1.75} className="text-faint" aria-hidden />,
  success: <CircleCheck size={13} strokeWidth={1.75} className="text-success" aria-hidden />,
  error: <TriangleAlert size={13} strokeWidth={1.75} className="text-danger" aria-hidden />,
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-(--z-toast) flex flex-col gap-2">
      {toasts.map((item) => (
        <button
          key={item.id}
          type="button"
          role="status"
          onClick={() => dismiss(item.id)}
          className={cn(
            'menu-shadow pointer-events-auto flex animate-toast-in items-center gap-2',
            'rounded-lg border border-border bg-raised py-2 pl-2.5 pr-3 text-left',
          )}
        >
          {TONE_ICON[item.tone]}
          <span className="max-w-72 text-[12px] text-foreground">{item.message}</span>
        </button>
      ))}
    </div>
  )
}
