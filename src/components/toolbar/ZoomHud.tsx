import { Minus, Plus } from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import { IconButton } from '@/components/ui/icon-button'

/** Floating bottom-right zoom HUD. */
export function ZoomHud() {
  const zoom = useUIStore((s) => s.zoom)
  const zoomIn = useUIStore((s) => s.zoomIn)
  const zoomOut = useUIStore((s) => s.zoomOut)
  const resetZoom = useUIStore((s) => s.resetZoom)

  return (
    <div className="island flex h-9 items-center gap-0.5 px-1">
      <IconButton size="sm" aria-label="Zoom arrière" title="Zoom arrière (⌘−)" onClick={zoomOut}>
        <Minus size={13} strokeWidth={1.75} />
      </IconButton>
      <button
        type="button"
        aria-label="Ajuster le zoom aux écrans"
        title="Ajuster aux écrans (⌘0)"
        onClick={resetZoom}
        className="mono-value h-7 min-w-12 rounded-md px-1.5 text-center text-[11px] text-foreground-muted transition-colors duration-150 ease-out hover:bg-surface-hover hover:text-foreground"
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton size="sm" aria-label="Zoom avant" title="Zoom avant (⌘+)" onClick={zoomIn}>
        <Plus size={13} strokeWidth={1.75} />
      </IconButton>
    </div>
  )
}
